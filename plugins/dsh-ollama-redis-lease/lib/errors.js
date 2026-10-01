/** @typedef {'LEASE_HTTP_ERROR' | 'LEASE_INVALID_RESPONSE' | 'LEASE_TOKEN_MISSING' | 'LEASE_TIMEOUT'} LeaseErrorCode */

/**
 * Operational failure from the HTTP lease API.
 */
export class LeaseError extends Error {
  /**
   * @param {LeaseErrorCode} code
   * @param {string} message
   * @param {unknown} [cause]
   */
  constructor(code, message, cause) {
    super(message, { cause })
    this.name = 'LeaseError'
    this.code = code
  }
}
