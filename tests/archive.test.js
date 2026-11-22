import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { scryptSync, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { calculateAndValidateExam, examPath } from '../api/_lib/data.js'
import { deleteJson, readJson, writeJson } from '../api/_lib/github.js'
import { isAdmin, login, requireCsrf, sessionInfo } from '../api/_lib/auth.js'
import { issueSession } from '../api/_lib/auth.js'
import publicSearch from '../api/public/search.js'
import adminSearch from '../api/admin/search.js'

const validExam = () => ({
  id: 'primary-2025-burmese', classId: 'primary', year: 2025, subjectId: 'burmese',
  title: '2025 Examination', status: 'draft', totalMarks: 0,
  sections: [{ id: 'section-1', title: 'Section 1', order: 1, marks: 0, questions: [
    { id: 'q001', number: 1, type: 'long_answer', question: '<p>မေးခွန်း</p>', answer: '<p>အဖြေ</p>', marks: 10, order: 1 },
  ] }],
})

const searchIndex = [
  { id: 'exam-a', classId: 'primary', className: 'Primary', year: 2025, subjectId: 'burmese', subjectName: 'Burmese', title: 'Archive A', sections: [{ id: 's1', questions: [
    { id: 'q1', number: 1, questionText: 'Alpha metta prompt', answerText: 'First answer', keywords: ['pali-term'] },
    { id: 'q2', number: 2, questionText: 'Second prompt', answerText: 'Dhamma answer', keywords: ['alpha-term'] },
  ] }] },
  { id: 'exam-b', classId: 'first-level', className: 'First level', year: 2024, subjectId: 'pali', subjectName: 'Pali', title: 'Archive B', sections: [{ id: 's2', questions: [
    { id: 'q3', number: 1, questionText: 'Other prompt', answerText: 'Other answer', keywords: ['other-term'] },
  ] }] },
]

function mockResponse(status, payload) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload }
}

beforeEach(() => {
  process.env.GITHUB_TOKEN = 'test-token'
  process.env.GITHUB_OWNER = 'archive-owner'
  process.env.GITHUB_REPO = 'archive-data'
  process.env.GITHUB_BRANCH = 'main'
  process.env.GITHUB_DATA_PATH = 'public/data'
})

test('exam validation calculates section and total marks and preserves Unicode HTML', () => {
  const normalized = calculateAndValidateExam(validExam(), { classId: 'primary', subjectId: 'burmese', subjectName: 'မြန်မာစာ', year: 2025 })
  assert.equal(normalized.totalMarks, 10)
  assert.equal(normalized.sections[0].marks, 10)
  assert.equal(normalized.sections[0].questions[0].question, '<p>မေးခွန်း</p>')
  assert.equal(normalized.subjectName, 'မြန်မာစာ')
})

test('exam validation rejects duplicate question IDs, unsupported types, and invalid years', () => {
  const duplicated = validExam()
  duplicated.sections[0].questions.push({ ...duplicated.sections[0].questions[0], number: 2, order: 2 })
  assert.throws(() => calculateAndValidateExam(duplicated, { classId: 'primary', subjectId: 'burmese', subjectName: 'Burmese', year: 2025 }), /unique/i)
  const unsupported = validExam()
  unsupported.sections[0].questions[0].type = 'pdf'
  assert.throws(() => calculateAndValidateExam(unsupported, { classId: 'primary', subjectId: 'burmese', subjectName: 'Burmese', year: 2025 }), /Unsupported question type/)
  assert.throws(() => examPath('primary', '2027', 'burmese'), /Invalid examination reference/)
  assert.equal(examPath('primary', '2025', 'burmese'), 'exams/primary/2025/burmese.json')
})

test('public examination view keeps sanitized answers and marks beside ordered questions', () => {
  const source = readFileSync(new URL('../src/pages/public/ExamPage.jsx', import.meta.url), 'utf8')
  assert.match(source, /DOMPurify\.sanitize/)
  assert.match(source, /sort\(\(a, b\) => Number\(a\.number\) - Number\(b\.number\)/)
  assert.match(source, /\{question\.marks\} Marks/)
  assert.match(source, /question\.answer/)
  assert.doesNotMatch(source, /Show Answer|show answer/i)
})

test('public search handles class, year, subject, question, answer, keyword, combined filters, and pagination', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => mockResponse(200, { content: Buffer.from(JSON.stringify(searchIndex)).toString('base64'), sha: 'index-sha' })
  async function search(query) {
    const res = { setHeader() { return this }, status(code) { this.statusCode = code; return this }, end(body) { this.body = body } }
    await publicSearch({ method: 'GET', query }, res)
    return { status: res.statusCode, data: JSON.parse(res.body) }
  }
  try {
    assert.equal((await search({ classSlug: 'primary' })).data.total, 2)
    assert.equal((await search({ year: '2024' })).data.total, 1)
    assert.equal((await search({ subjectId: 'pali' })).data.total, 1)
    assert.equal((await search({ query: 'METTA' })).data.results[0].id, 'q1')
    assert.equal((await search({ query: 'dhamma' })).data.results[0].id, 'q2')
    assert.equal((await search({ query: 'pali-term' })).data.results[0].id, 'q1')
    const combined = await search({ query: 'alpha', classSlug: 'primary', year: '2025', subjectId: 'burmese', page: '2', pageSize: '1' })
    assert.equal(combined.data.total, 2)
    assert.equal(combined.data.results[0].id, 'q2')
    assert.equal(combined.data.page, 2)
  } finally { globalThis.fetch = originalFetch }
})

test('admin search requires a session and applies metadata and question filters', async () => {
  process.env.SESSION_SECRET = 'test-session-secret-long-enough-for-unit-tests'
  const { token } = await issueSession()
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    const value = String(url)
    if (value.includes('/contents/public/data/classes.json')) return mockResponse(200, { content: Buffer.from(JSON.stringify([{ id: 'primary', slug: 'primary', name: 'Primary' }, { id: 'first-level', slug: 'first-level', name: 'First level' }])).toString('base64'), sha: 'classes-sha' })
    if (value.includes('/contents/public/data/subjects.json')) return mockResponse(200, { content: Buffer.from(JSON.stringify([{ id: 'burmese', classId: 'primary', name: 'Burmese' }, { id: 'pali', classId: 'first-level', name: 'Pali' }])).toString('base64'), sha: 'subjects-sha' })
    if (value.includes('/contents/public/data/index.json')) return mockResponse(200, { content: Buffer.from(JSON.stringify(searchIndex)).toString('base64'), sha: 'index-sha' })
    if (value.includes('/git/ref/heads/')) return mockResponse(200, { object: { sha: 'head-sha' } })
    if (value.includes('/git/commits/head-sha')) return mockResponse(200, { tree: { sha: 'tree-sha' } })
    if (value.includes('/git/trees/tree-sha')) return mockResponse(200, { tree: [] })
    throw Error(`Unexpected mocked GitHub URL: ${value}`)
  }
  async function search(query, authenticated = true) {
    const res = { setHeader() { return this }, status(code) { this.statusCode = code; return this }, end(body) { this.body = body } }
    await adminSearch({ method: 'GET', headers: authenticated ? { cookie: `archive_session=${token}` } : {}, query }, res)
    return { status: res.statusCode, data: JSON.parse(res.body) }
  }
  try {
    assert.equal((await search({ query: 'dhamma', classId: 'primary', year: '2025', subjectId: 'burmese', questionNumber: '2', status: 'published' })).data.results[0].questionId, 'q2')
    assert.equal((await search({ status: 'published', title: 'archive b' })).data.results[0].questionId, 'q3')
    assert.equal((await search({}, false)).status, 401)
  } finally { globalThis.fetch = originalFetch }
})

test('GitHub JSON reads from the configured branch and parses JSON', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    assert.match(String(url), /contents\/public\/data\/classes\.json\?ref=main$/)
    return mockResponse(200, { content: Buffer.from('[{"id":"primary"}]').toString('base64'), sha: 'file-sha' })
  }
  try { assert.deepEqual(await readJson('classes.json'), { data: [{ id: 'primary' }], sha: 'file-sha' }) }
  finally { globalThis.fetch = originalFetch }
})

test('GitHub writes and deletions require a confirmed commit SHA', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_url, options) => {
    assert.ok(['PUT', 'DELETE'].includes(options.method))
    return mockResponse(200, { commit: { sha: 'commit-sha' } })
  }
  try {
    assert.equal((await writeJson('classes.json', [], 'Test create')).commit.sha, 'commit-sha')
    assert.equal((await deleteJson('classes.json', 'file-sha', 'Test delete')).commit.sha, 'commit-sha')
  } finally { globalThis.fetch = originalFetch }
})

test('GitHub rejects path traversal and reports SHA conflicts', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => mockResponse(409, { message: 'sha conflict' })
  try {
    await assert.rejects(writeJson('../secrets.json', {}, 'Invalid path'), /Invalid JSON storage path/)
    await assert.rejects(writeJson('classes.json', [], 'Concurrent update'), (error) => error.status === 409)
  } finally { globalThis.fetch = originalFetch }
})

test('admin login requires configured username and password and issues an HTTP-only session', async () => {
  const salt = randomBytes(16)
  const password = 'unit-test-password'
  process.env.ADMIN_USERNAME = 'test-admin'
  process.env.ADMIN_PASSWORD_HASH = `scrypt$${salt.toString('hex')}$${scryptSync(password, salt, 64).toString('hex')}`
  process.env.SESSION_SECRET = 'test-session-secret-long-enough-for-unit-tests'
  const req = { headers: { 'x-forwarded-for': '192.0.2.44' } }
  const res = { setHeader(name, value) { this[name] = value } }
  assert.deepEqual(await login(req, res, 'wrong-user', password), { ok: false })
  const result = await login(req, res, 'test-admin', password)
  assert.equal(result.ok, true)
  assert.match(res['Set-Cookie'], /HttpOnly/i)
  const token = res['Set-Cookie'].split(';')[0].split('=').slice(1).join('=')
  const authenticatedReq = { headers: { cookie: `archive_session=${token}`, origin: 'https://archive.test', host: 'archive.test', 'x-forwarded-host': 'archive.test', 'sec-fetch-site': 'same-origin', 'x-csrf-token': result.csrfToken } }
  assert.equal((await sessionInfo(authenticatedReq)).authenticated, true)
  assert.equal(await isAdmin(authenticatedReq), true)
  assert.equal(await requireCsrf(authenticatedReq), true)
  assert.equal(await requireCsrf({ ...authenticatedReq, headers: { ...authenticatedReq.headers, 'x-csrf-token': 'invalid' } }), false)
})
