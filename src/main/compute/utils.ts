/**
 * Shared utilities for the compute layer.
 */

export function formatGameDate(timeSeconds: number, startYear: number): string {
  const totalDays = timeSeconds / 86400
  const yearsElapsed = Math.floor(totalDays / 365.25)
  const remainingDays = totalDays - yearsElapsed * 365.25
  const year = startYear + yearsElapsed
  const month = Math.floor(remainingDays / 30.44) + 1
  const day = Math.floor(remainingDays % 30.44) + 1
  const m = month < 10 ? `0${month}` : month
  const d = day < 10 ? `0${day}` : day
  return `${year}-${m}-${d}`
}

export function euclidean(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}
