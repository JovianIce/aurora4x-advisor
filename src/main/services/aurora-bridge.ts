import WebSocket from 'ws'
import { BrowserWindow } from 'electron'
import type { BridgeStatus, ActionRequest } from '@shared/types'

// Must match BridgeProtocol.Version in C# AdvisorBridge/Protocol.cs
const EXPECTED_PROTOCOL_VERSION = 1

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  timeout: ReturnType<typeof setTimeout>
}

interface BridgeResponse {
  Id: string | null
  Type: string
  Payload: unknown
  Success: boolean
  Error: string | null
}

class AuroraBridge {
  private ws: WebSocket | null = null
  private pendingRequests = new Map<string, PendingRequest>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private maxReconnectDelay = 30000
  private _isConnected = false
  private _lastError: string | null = null
  private _url = 'ws://localhost:47842'
  private _autoReconnect = false
  private messageIdCounter = 0
  private pushListeners: Array<(payload: unknown) => void> = []

  get isConnected(): boolean {
    return this._isConnected
  }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  connect(port?: number): void {
    if (port) {
      this._url = `ws://localhost:${port}`
    }
    this._autoReconnect = true
    this.reconnectDelay = 1000
    this.doConnect()
  }

  reconnectNow(): void {
    this.clearReconnectTimer()
    this.reconnectDelay = 1000
    this.doConnect()
  }

  disconnect(): void {
    this._autoReconnect = false
    this.clearReconnectTimer()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this._isConnected = false
  }

  getStatus(): BridgeStatus {
    return {
      isConnected: this._isConnected,
      url: this._url,
      lastError: this._lastError
    }
  }

  onPush(listener: (payload: unknown) => void): () => void {
    this.pushListeners.push(listener)
    return () => {
      this.pushListeners = this.pushListeners.filter((l) => l !== listener)
    }
  }

  // ---------------------------------------------------------------------------
  // Real-time memory data (primary API)
  // ---------------------------------------------------------------------------

  async subscribeBodies(systemId: number | null): Promise<unknown> {
    return this.send('subscribe', systemId != null ? { SystemId: systemId } : null)
  }

  async getBodies(systemId?: number): Promise<Record<string, unknown>[]> {
    return this.send('getBodies', systemId != null ? { SystemId: systemId } : null) as Promise<
      Record<string, unknown>[]
    >
  }

  async getKnownSystems(): Promise<{ SystemID: number; Name: string }[]> {
    return this.send('getKnownSystems', null) as Promise<{ SystemID: number; Name: string }[]>
  }

  async getFleets(): Promise<Record<string, unknown>[]> {
    return this.send('getFleets', null) as Promise<Record<string, unknown>[]>
  }

  // ---------------------------------------------------------------------------
  // Memory introspection (dev tools)
  // ---------------------------------------------------------------------------

  async enumerateGameState(): Promise<unknown[]> {
    return this.send('enumerateGameState', null) as Promise<unknown[]>
  }

  async enumerateCollections(): Promise<unknown[]> {
    return this.send('enumerateCollections', null) as Promise<unknown[]>
  }

  async readCollection(params: {
    Field: string
    Offset?: number
    Limit?: number
    Fields?: string[]
    IncludeRefs?: boolean
    FilterField?: string
    FilterValue?: string
  }): Promise<unknown[]> {
    return this.send('readCollection', params) as Promise<unknown[]>
  }

  // ---------------------------------------------------------------------------
  // SQL query + actions
  // ---------------------------------------------------------------------------

  /** Smart SQL query — auto-detects FCT_* tables and selectively refreshes only those. */
  async query<T = unknown>(sql: string, timeoutMs = 30000): Promise<T[]> {
    return this.send('query', { Sql: sql }, timeoutMs) as Promise<T[]>
  }

  /** Full refresh query — refreshes ALL tables. Use for PRAGMA / sqlite_master. */
  async queryFull<T = unknown>(sql: string, timeoutMs = 30000): Promise<T[]> {
    return this.send('query.full', { Sql: sql }, timeoutMs) as Promise<T[]>
  }

  async executeAction(action: ActionRequest): Promise<unknown> {
    return this.send('action', action)
  }

  /** Get the save-method-to-table mapping (available after first query triggers discovery). */
  async getTableMapping(): Promise<unknown> {
    return this.send('getTableMapping', null)
  }

  /** Force re-discovery of the table mapping. Run after progressing game time to catch UPDATEs. */
  async rediscoverMapping(): Promise<unknown> {
    return this.send('rediscoverMapping', null, 120000)
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private send(type: string, payload: unknown, timeoutMs = 10000): Promise<unknown> {
    const id = this.nextId()
    const request = {
      Id: id,
      Type: type,
      Payload: payload != null ? JSON.stringify(payload) : null
    }
    return this.sendRequest(id, request, timeoutMs)
  }

  private doConnect(): void {
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        // ignore
      }
    }

    try {
      this.ws = new WebSocket(this._url)

      this.ws.on('open', () => {
        console.log('[AuroraBridge] Connected to', this._url)
        const wasConnected = this._isConnected
        this._isConnected = true
        this._lastError = null
        this.reconnectDelay = 1000

        // Check bridge protocol version
        console.log('[AuroraBridge] Sending ping to check protocol version...')
        this.send('ping', null)
          .then((payload) => {
            console.log('[AuroraBridge] Ping response:', payload)
            const version = (payload as { protocolVersion?: number })?.protocolVersion ?? 0
            if (version !== EXPECTED_PROTOCOL_VERSION) {
              console.log(
                `[AuroraBridge] Protocol mismatch: bridge=${version}, app=${EXPECTED_PROTOCOL_VERSION}`
              )
              // Delay to ensure renderer has mounted listeners
              setTimeout(() => {
                this.broadcastToRenderers('bridge:versionMismatch', {
                  bridgeVersion: version,
                  appVersion: EXPECTED_PROTOCOL_VERSION
                })
              }, 2000)
            }
          })
          .catch(() => {
            // Old bridge without version support - that's a mismatch too
            this.broadcastToRenderers('bridge:versionMismatch', {
              bridgeVersion: 0,
              appVersion: EXPECTED_PROTOCOL_VERSION
            })
          })

        if (!wasConnected) {
          this.broadcastToRenderers('bridge:connected', null)
        }
      })

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString())
      })

      this.ws.on('close', () => {
        console.log('[AuroraBridge] Disconnected')
        const wasConnected = this._isConnected
        this._isConnected = false
        this.rejectAllPending('Connection closed')
        this.scheduleReconnect()
        if (wasConnected) {
          this.broadcastToRenderers('bridge:disconnected', null)
        }
      })

      this.ws.on('error', (err) => {
        this._lastError = err.message
        this._isConnected = false
      })
    } catch (err) {
      this._lastError = err instanceof Error ? err.message : String(err)
      this.scheduleReconnect()
    }
  }

  private handleMessage(raw: string): void {
    let msg: BridgeResponse
    try {
      msg = JSON.parse(raw)
    } catch {
      console.error('[AuroraBridge] Invalid JSON from server')
      return
    }

    // Push notification (no Id)
    if (msg.Type === 'push' && !msg.Id) {
      this.broadcastToRenderers('bridge:push', msg.Payload)
      for (const listener of this.pushListeners) {
        try {
          listener(msg.Payload)
        } catch {
          // ignore listener errors
        }
      }
      return
    }

    // Response to a pending request
    if (msg.Id && this.pendingRequests.has(msg.Id)) {
      const pending = this.pendingRequests.get(msg.Id)!
      this.pendingRequests.delete(msg.Id)
      clearTimeout(pending.timeout)

      if (msg.Success) {
        pending.resolve(msg.Payload)
      } else {
        pending.reject(new Error(msg.Error || 'Unknown bridge error'))
      }
    }
  }

  private sendRequest(id: string, message: unknown, timeoutMs = 10000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Bridge not connected'))
        return
      }

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error('Bridge request timeout'))
      }, timeoutMs)

      this.pendingRequests.set(id, { resolve, reject, timeout })

      this.ws.send(JSON.stringify(message), (err) => {
        if (err) {
          this.pendingRequests.delete(id)
          clearTimeout(timeout)
          reject(err)
        }
      })
    })
  }

  private scheduleReconnect(): void {
    if (!this._autoReconnect) return

    this.clearReconnectTimer()
    this.reconnectTimer = setTimeout(() => {
      console.log(`[AuroraBridge] Reconnecting in ${this.reconnectDelay}ms...`)
      this.doConnect()
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
    }, this.reconnectDelay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private rejectAllPending(reason: string): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error(reason))
    }
    this.pendingRequests.clear()
  }

  private broadcastToRenderers(channel: string, data: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }
  }

  private nextId(): string {
    return `req_${++this.messageIdCounter}_${Date.now()}`
  }
}

export const auroraBridge = new AuroraBridge()
