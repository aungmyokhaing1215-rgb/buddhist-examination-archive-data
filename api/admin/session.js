import { sessionInfo } from '../_lib/auth.js'
import { send, method } from '../_lib/http.js'
export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return
  const session = await sessionInfo(req)
  send(res, session.authenticated ? 200 : 401, session)
}
