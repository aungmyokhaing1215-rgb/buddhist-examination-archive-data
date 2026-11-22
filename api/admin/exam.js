import { isAdmin, requireCsrf } from '../_lib/auth.js'
import { readJson, writeJson, deleteJson } from '../_lib/github.js'
import { readSource, examPath, calculateAndValidateExam, updateIndex } from '../_lib/data.js'
import { send, method, body, fail } from '../_lib/http.js'

async function reference(classSlug, year, subjectId) {
  const [classes, subjects] = await Promise.all([readSource('classes'), readSource('subjects')])
  const cls = classes.data.find((item) => item.slug === classSlug)
  const subject = subjects.data.find((item) => item.classId === cls?.id && (item.id === subjectId || item.slug === subjectId))
  if (!cls || !subject) throw Error('Select a valid class and subject')
  const path = examPath(cls.slug, year, subject.slug)
  return { cls, subject, path, draftPath: `drafts/${path.slice('exams/'.length)}` }
}

export default async function handler(req, res) {
  if (!method(req, res, ['GET', 'PUT', 'DELETE'])) return
  if (!await isAdmin(req)) return send(res, 401, { error: 'Authentication required' })
  if (req.method !== 'GET' && !await requireCsrf(req)) return send(res, 403, { error: 'CSRF validation failed' })
  try {
    if (req.method === 'GET') {
      const ref = await reference(req.query.classSlug, String(req.query.year), req.query.subjectId)
      const draft = await readJson(ref.draftPath, '')
      const saved = draft.data ? draft : await readJson(ref.path)
      return saved.data ? send(res, 200, saved.data) : send(res, 404, { error: 'No saved examination for this selection' })
    }
    const input = body(req)
    const ref = await reference(input.classSlug, String(input.year), input.subjectId)
    if (req.method === 'DELETE') {
      const [draft, published] = await Promise.all([readJson(ref.draftPath, ''), readJson(ref.path)])
      if (!draft.data && !published.data) return send(res, 404, { error: 'Examination not found' })
      if (published.data) {
        const index = await readSource('index')
        await writeJson('index.json', index.data.filter((entry) => entry.id !== published.data.id), `Remove examination ${published.data.id} from search`, index.sha)
        await deleteJson(ref.path, published.sha, `Delete examination ${published.data.id}`)
      }
      if (draft.sha) await deleteJson(ref.draftPath, draft.sha, `Delete examination draft ${draft.data.id}`, '')
      return send(res, 200, { ok: true })
    }
    const candidate = { ...input, id: `${ref.cls.id}-${input.year}-${ref.subject.slug}`, classId: ref.cls.id, year: Number(input.year), subjectId: ref.subject.id, subjectName: ref.subject.name, status: 'draft' }
    const exam = calculateAndValidateExam(candidate, { classId: ref.cls.id, subjectId: ref.subject.id, subjectName: ref.subject.name, year: input.year })
    const old = await readJson(ref.draftPath, '')
    await writeJson(ref.draftPath, exam, `Save draft: ${ref.cls.slug} ${input.year} ${ref.subject.slug}`, old.sha, '')
    return send(res, 200, { ok: true, totalMarks: exam.totalMarks })
  } catch (error) {
    if (error.status === 409) return send(res, 409, { error: 'Data changed elsewhere. Reload before saving.' })
    if (error.message?.startsWith('Select ') || /must|required|At least|unique|Unsupported|marks|strings|Year|structure|Question|Invalid examination reference/.test(error.message || '')) return send(res, 400, { error: error.message })
    fail(res, error)
  }
}
