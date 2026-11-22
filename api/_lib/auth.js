import { SignJWT, jwtVerify } from 'jose'
import { parse, serialize } from 'cookie'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const cookieName = 'archive_session'
const attempts = new Map()
const windowMs = 15 * 60 * 1000
const maxAttempts = 5

function secret() {
  const value = process.env.SESSION_SECRET
  if (!value || value.length < 32) throw Error('SESSION_SECRET must contain at least 32 characters')
  return new TextEncoder().encode(value)
}

function ipKey(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
  return createHash('sha256').update(ip).digest('hex')
}

function rateLimit(req) {
  const key = ipKey(req)
  const now = Date.now()
  const record = attempts.get(key)
  if (!record || record.until <= now) {
    attempts.set(key, { count: 0, until: now + windowMs })
    return { allowed: true, key }
  }
  return { allowed: record.count < maxAttempts, key, retryAfter: Math.ceil((record.until - now) / 1000) }
}

function checkHash(password) {
  const encoded = process.env.ADMIN_PASSWORD_HASH || ''
  const [scheme, salt, expected] = encoded.split('$')
  if (scheme !== 'scrypt' || !salt || !expected) return Promise.resolve(false)
  return scrypt(String(password || ''), Buffer.from(salt, 'hex'), 64).then((actual) => {
    const wanted = Buffer.from(expected, 'hex')
    return wanted.length === actual.length && timingSafeEqual(wanted, actual)
  })
}

export async function issueSession() {
  const csrfToken = randomBytes(32).toString('hex')
  const token = await new SignJWT({ role: 'admin', csrf: csrfToken }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('8h').sign(secret())
  return { token, csrfToken }
}

async function payloadFor(req) {
  const token = parse(req.headers.cookie || '')[cookieName]
  if (!token) return null
  const { payload } = await jwtVerify(token, secret())
  return payload
}

export async function isAdmin(req) {
  try { return (await payloadFor(req))?.role === 'admin' } catch { return false }
}

export async function sessionInfo(req) {
  try {
    const payload = await payloadFor(req)
    return payload?.role === 'admin' ? { authenticated: true, csrfToken: payload.csrf } : { authenticated: false }
  } catch { return { authenticated: false } }
}

export async function requireCsrf(req) {
  try {
    const payload = await payloadFor(req)
    const origin = req.headers.origin
    const host = req.headers['x-forwarded-host'] || req.headers.host
    const site = req.headers['sec-fetch-site']
    return payload?.role === 'admin' && payload.csrf && req.headers['x-csrf-token'] === payload.csrf && origin && host && new URL(origin).host === host && site !== 'cross-site'
  } catch { return false }
}

export function loginRate(req) { return rateLimit(req) }
export function recordLoginFailure(key) {
  const record = attempts.get(key) || { count: 0, until: Date.now() + windowMs }
  record.count += 1
  attempts.set(key, record)
}
export function clearLoginFailures(key) { attempts.delete(key) }

function checkUsername(username) {
  const expected = process.env.ADMIN_USERNAME || ''
  const suppliedHash = createHash('sha256').update(String(username || '')).digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return Boolean(expected) && timingSafeEqual(suppliedHash, expectedHash)
}

export async function login(req, res, username, password) {
  const limit = rateLimit(req)
  if (!limit.allowed) return { ok: false, limited: true, retryAfter: limit.retryAfter }
  if (!checkUsername(username) || !await checkHash(password)) {
    recordLoginFailure(limit.key)
    return { ok: false }
  }
  clearLoginFailures(limit.key)
  const { token, csrfToken } = await issueSession()
  res.setHeader('Set-Cookie', serialize(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict', path: '/', maxAge: 28800 }))
  return { ok: true, csrfToken }
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', serialize(cookieName, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict', path: '/', maxAge: 0 }))
}
