import { clearSession, isAdmin, requireCsrf } from '../_lib/auth.js'
import { send, method } from '../_lib/http.js'
export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return
  if (await isAdmin(req) && !await requireCsrf(req)) return send(res, 403, { error: 'CSRF validation failed' })
  clearSession(res)
  send(res, 200, { ok: true })
}
