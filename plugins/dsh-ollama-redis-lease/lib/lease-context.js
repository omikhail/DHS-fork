import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Per-stream lease from HTTP acquire (`secret` is the Ollama API key; never log it).
 * @typedef {{ id: string, label: string, secret: string, lockSeconds?: number }} ActiveLease
 */

const storage = new AsyncLocalStorage()

/**
 * @returns {ActiveLease | undefined}
 */
export function getActiveLease() {
  return storage.getStore()
}

/**
 * @param {ActiveLease} lease
 */
export function enterActiveLease(lease) {
  storage.enterWith(lease)
}

/** Test hook: clear ALS between cases. */
export function clearActiveLease() {
  storage.enterWith(undefined)
}
