import crypto from 'node:crypto'
import type { ID } from '@/lib/types'

function normalizePrimitiveId(value: string | number): ID | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed)
  }
  return trimmed
}

export function getId(value: unknown): ID | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number') return normalizePrimitiveId(value)
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const possibleId = (value as { id?: ID }).id
    return typeof possibleId === 'string' || typeof possibleId === 'number' ? normalizePrimitiveId(possibleId) : null
  }
  return null
}

export function sameId(a: unknown, b: unknown): boolean {
  const aId = getId(a)
  const bId = getId(b)
  if (aId === null || bId === null) return false
  return String(aId) === String(bId)
}

export function randomToken(size = 24): string {
  return crypto.randomBytes(size).toString('hex')
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}
