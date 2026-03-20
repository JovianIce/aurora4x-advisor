import WebSocket from 'ws'
import { BrowserWindow } from 'electron'
import type { BridgeStatus, ActionRequest } from '@shared/types'

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

  get isConnected(): boolean {
    return this._isConnected
  }

  connect(port?: number): void {
    if (port) {
      this._url = `ws://localhost:${port}`
    }

    this._autoReconnect = true
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

  async query<T = unknown>(sql: string): Promise<T[]> {
    const id = this.nextId()
    const request = {
      Id: id,
      Type: 'query',
      Payload: JSON.stringify({ Sql: sql })
    }

    return this.sendRequest(id, request) as Promise<T[]>
  }

  async subscribeBodies(systemId: number | null): Promise<unknown> {
    const id = this.nextId()
    const request = {
      Id: id,
      Type: 'subscribe',
      Payload: systemId != null ? JSON.stringify({ SystemId: systemId }) : null
    }
    return this.sendRequest(id, request)
  }

  async getMemorySystems(): Promise<{ SystemID: number; Name: string }[]> {
    const id = this.nextId()
    const request = { Id: id, Type: 'getSystems', Payload: null }
    return this.sendRequest(id, request) as Promise<{ SystemID: number; Name: string }[]>
  }

  async globalSearch(values: number[]): Promise<Record<string, unknown>[]> {
    const id = this.nextId()
    const request = {
      Id: id,
      Type: 'globalSearch',
      Payload: JSON.stringify({ Values: values })
    }
    return this.sendRequest(id, request) as Promise<Record<string, unknown>[]>
  }

  async getMemoryBodies2(systemId?: number): Promise<Record<string, unknown>[]> {
    const id = this.nextId()
    const request = {
      Id: id,
      Type: 'getBodies',
      Payload: systemId != null ? JSON.stringify({ SystemId: systemId }) : null
    }
    return this.sendRequest(id, request) as Promise<Record<string, unknown>[]>
  }

  async getMemoryBodies(systemId?: number): Promise<Record<string, unknown>[]> {
    const id = this.nextId()
    const request = {
      Id: id,
      Type: 'getSystemBodies',
      Payload: systemId != null ? JSON.stringify({ SystemId: systemId }) : null
    }
    return this.sendRequest(id, request) as Promise<Record<string, unknown>[]>
  }

  async getKnownSystems(): Promise<{ SystemID: number; Name: string }[]> {
    const id = this.nextId()
    const request = { Id: id, Type: 'getKnownSystems', Payload: null }
    return this.sendRequest(id, request) as Promise<{ SystemID: number; Name: string }[]>
  }

  async getFleets(): Promise<Record<string, unknown>[]> {
    const id = this.nextId()
    const request = { Id: id, Type: 'getFleets', Payload: null }
    return this.sendRequest(id, request) as Promise<Record<string, unknown>[]>
  }

  async getShips(fleetId?: number): Promise<Record<string, unknown>[]> {
    const id = this.nextId()
    const request = {
      Id: id,
      Type: 'getShips',
      Payload: fleetId != null ? JSON.stringify({ FleetId: fleetId }) : null
    }
    return this.sendRequest(id, request) as Promise<Record<string, unknown>[]>
  }

  async enumerateGameState(): Promise<unknown[]> {
    const id = this.nextId()
    const request = { Id: id, Type: 'enumerateGameState', Payload: null }
    return this.sendRequest(id, request) as Promise<unknown[]>
  }

  async enumerateCollections(): Promise<unknown[]> {
    const id = this.nextId()
    const request = { Id: id, Type: 'enumerateCollections', Payload: null }
    return this.sendRequest(id, request) as Promise<unknown[]>
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
    const id = this.nextId()
    const request = {
      Id: id,
      Type: 'readCollection',
      Payload: JSON.stringify(params)
    }
    return this.sendRequest(id, request) as Promise<unknown[]>
  }

  async readField(fieldName: string): Promise<unknown> {
    const id = this.nextId()
    const request = {
      Id: id,
      Type: 'readField',
      Payload: JSON.stringify({ Field: fieldName })
    }
    return this.sendRequest(id, request)
  }

  async executeAction(action: ActionRequest): Promise<unknown> {
    const id = this.nextId()
    const request = {
      Id: id,
      Type: 'action',
      Payload: JSON.stringify(action)
    }
    return this.sendRequest(id, request)
  }

  async inspectForm(formName: string): Promise<unknown> {
    const id = this.nextId()
    const request = {
      Id: id,
      Type: 'inspect',
      Payload: JSON.stringify({ FormName: formName })
    }
    return this.sendRequest(id, request)
  }

  async ping(): Promise<boolean> {
    try {
      const id = this.nextId()
      await this.sendRequest(id, { Id: id, Type: 'ping', Payload: null })
      return true
    } catch {
      return false
    }
  }

  getStatus(): BridgeStatus {
    return {
      isConnected: this._isConnected,
      url: this._url,
      lastError: this._lastError
    }
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
        this._isConnected = true
        this._lastError = null
        this.reconnectDelay = 1000
      })

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString())
      })

      this.ws.on('close', () => {
        console.log('[AuroraBridge] Disconnected')
        this._isConnected = false
        this.rejectAllPending('Connection closed')
        this.scheduleReconnect()
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

  private sendRequest(id: string, message: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Bridge not connected'))
        return
      }

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error('Bridge request timeout'))
      }, 10000)

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
