import { getActiveLease } from './lease-context.js'

/**
 * Patch `inner.resolve` to serve leased Ollama keys from ALS during `llm/stream`.
 *
 * @param {import('@deepseek-ai/dsh-credentials').CredentialProvider} inner
 * @param {{ credentialRef: string, allowStaticFallback: boolean }} options
 * @returns {() => void} disposer restoring the original resolve
 */
export function patchCredentialsResolve(inner, options) {
  const original = inner.resolve.bind(inner)
  const targetRef = options.credentialRef

  inner.resolve = async (ref) => {
    const refName = String(ref)
    if (refName !== targetRef) {
      return original(ref)
    }
    const lease = getActiveLease()
    if (lease) {
      return { value: lease.secret, source: 'ollama-http-lease' }
    }
    if (options.allowStaticFallback) {
      return original(ref)
    }
    return undefined
  }

  return () => {
    inner.resolve = original
  }
}
