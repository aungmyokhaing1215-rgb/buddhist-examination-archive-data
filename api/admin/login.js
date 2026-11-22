import { login } from '../_lib/auth.js'
import { send, method, body, fail } from '../_lib/http.js'
export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return
  try {
    const credentials = body(req)
    const result = await login(req, res, credentials.username, credentials.password)
    if (result.limited) {
      res.setHeader('Retry-After', String(result.retryAfter))
      return send(res, 429, { error: 'Too many login attempts. Try again later.' })
    }
    if (!result.ok) return send(res, 401, { error: 'Invalid administrator credentials or authentication is not configured' })
    send(res, 200, { ok: true, csrfToken: result.csrfToken })
  } catch (error) { fail(res, error) }
}
