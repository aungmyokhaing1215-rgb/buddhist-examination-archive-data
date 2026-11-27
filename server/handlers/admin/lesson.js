import { isAdmin, requireCsrf } from '../../_lib/auth.js'
import { readJson, writeJson, deleteJson, treeFiles } from '../../_lib/github.js'
import { readSource, slugify } from '../../_lib/data.js'
import { send, method, body, fail } from '../../_lib/http.js'

const validSlug = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ''))
const validClassSlug = (value) => /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(String(value || ''))
const paths = (classSlug, subjectSlug, lessonSlug) => {
  if (!validClassSlug(classSlug) || !validSlug(subjectSlug) || !validSlug(lessonSlug) || String(lessonSlug).length > 80) throw Error('Invalid lesson path')
  const part = `${classSlug}/${subjectSlug}/${lessonSlug}.json`
  return { published: `lessons/${part}`, draft: `drafts/lessons/${part}` }
}
async function reference(input) {
  const [classes, subjects] = await Promise.all([readSource('classes'), readSource('subjects')])
  const cls = classes.data.find((item) => item.slug === input.classSlug && item.status === 'active')
  const subject = subjects.data.find((item) => item.classId === cls?.id && item.status === 'active' && (item.id === input.subjectId || item.slug === input.subjectSlug || item.id === input.subjectSlug))
  if (!cls || !subject) throw Error('Select a valid active class and subject')
  return { cls, subject }
}
function createRecord(input, ref, slug) {
  const title = String(input.title || '').trim()
  const content = typeof input.content === 'string' ? input.content : ''
  if (!title || title.length > 180) throw Error('Lesson title is required and must be under 180 characters')
  if (!content.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim()) throw Error('Lesson content is required')
  if (Buffer.byteLength(content, 'utf8') > 900000) throw Error('Lesson content exceeds the 900 KB limit')
  const now = new Date().toISOString()
  return {
    id: `${ref.cls.id}-${ref.subject.id}-${slug}`,
    classId: ref.cls.id, classSlug: ref.cls.slug, className: ref.cls.name,
    subjectId: ref.subject.id, subjectSlug: ref.subject.slug, subjectName: ref.subject.name,
    slug, title, content, status: 'draft',
    createdAt: input.createdAt || now, updatedAt: now,
  }
}
async function listLessons() {
  const [classes, subjects, lessonIndex, draftPaths] = await Promise.all([
    readSource('classes'), readSource('subjects'), readJson('lessons.json'), treeFiles('drafts', ''),
  ])
  const records = new Map()
  for (const lesson of Array.isArray(lessonIndex.data) ? lessonIndex.data : []) records.set(lesson.id, { ...lesson, storageStatus: 'published', hasPublished: true })
  for (const path of draftPaths.filter((item) => item.startsWith('drafts/lessons/'))) {
    const file = await readJson(path, '')
    if (!file.data) continue
    const cls = classes.data.find((item) => item.id === file.data.classId)
    const subject = subjects.data.find((item) => item.id === file.data.subjectId)
    records.set(file.data.id, { ...file.data, className: cls?.name || file.data.className, subjectName: subject?.name || file.data.subjectName, storageStatus: 'draft', hasPublished: records.has(file.data.id) })
  }
  return [...records.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}
async function savePublicIndex(lesson, remove = false) {
  const current = await readJson('lessons.json')
  const entries = Array.isArray(current.data) ? current.data : []
  const next = entries.filter((item) => item.id !== lesson.id)
  if (!remove) next.push({ id: lesson.id, slug: lesson.slug, title: lesson.title, classId: lesson.classId, classSlug: lesson.classSlug, className: lesson.className, subjectId: lesson.subjectId, subjectSlug: lesson.subjectSlug, subjectName: lesson.subjectName, path: `public/data/lessons/${lesson.classSlug}/${lesson.subjectSlug}/${lesson.slug}.json`, updatedAt: lesson.updatedAt })
  next.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  const saved = await writeJson('lessons.json', next, remove ? `Remove lesson from public index: ${lesson.id}` : `Update public lesson index: ${lesson.id}`, current.sha)
  if (!saved?.commit?.sha) throw Error('GitHub did not confirm the public lesson index update')
  return saved.commit.sha
}

export default async function handler(req, res) {
  if (!method(req, res, ['GET', 'PUT', 'POST', 'DELETE'])) return
  if (!await isAdmin(req)) return send(res, 401, { error: 'Authentication required' })
  if (req.method !== 'GET' && !await requireCsrf(req)) return send(res, 403, { error: 'CSRF validation failed' })
  try {
    if (req.method === 'GET') {
      if (req.query.list === '1') return send(res, 200, { lessons: await listLessons() })
      const ref = await reference(req.query)
      const filePaths = paths(ref.cls.slug, ref.subject.slug, req.query.slug)
      const [draft, published] = await Promise.all([readJson(filePaths.draft, ''), readJson(filePaths.published)])
      const record = draft.data || published.data
      return record ? send(res, 200, record) : send(res, 404, { error: 'Lesson not found' })
    }

    const input = body(req)
    const ref = await reference(input)
    if (req.method === 'DELETE') {
      const filePaths = paths(ref.cls.slug, ref.subject.slug, input.slug)
      const [published, draft] = await Promise.all([readJson(filePaths.published), readJson(filePaths.draft, '')])
      if (!published.data && !draft.data) return send(res, 404, { error: 'Lesson not found' })
      if (published.data) await savePublicIndex(published.data, true)
      if (published.sha) await deleteJson(filePaths.published, published.sha, `Delete lesson: ${published.data?.id || input.slug}`)
      if (draft.sha) await deleteJson(filePaths.draft, draft.sha, `Delete lesson draft: ${draft.data?.id || input.slug}`, '')
      return send(res, 200, { ok: true })
    }
    const slug = validSlug(input.slug) && input.slug.length <= 80 ? input.slug : slugify(input.title).slice(0, 80).replace(/-+$/g, '')
    const filePaths = paths(ref.cls.slug, ref.subject.slug, slug)
    const next = createRecord(input, ref, slug)

    if (req.method === 'PUT') {
      const old = await readJson(filePaths.draft, '')
      const saved = { ...next, createdAt: old.data?.createdAt || next.createdAt }
      const result = await writeJson(filePaths.draft, saved, `Save lesson draft: ${ref.cls.slug}/${ref.subject.slug}/${slug}`, old.sha, '')
      if (!result?.commit?.sha) throw Error('GitHub did not confirm the lesson draft commit')
      return send(res, 200, { ok: true, status: 'draft', lesson: saved, commit: result.commit.sha })
    }

    const draft = await readJson(filePaths.draft, '')
    const currentPublished = await readJson(filePaths.published)
    const source = draft.data || next
    const lesson = { ...source, ...next, createdAt: currentPublished.data?.createdAt || source.createdAt, status: 'published', updatedAt: new Date().toISOString() }
    const result = await writeJson(filePaths.published, lesson, `Publish lesson: ${ref.cls.slug}/${ref.subject.slug}/${slug}`, currentPublished.sha)
    if (!result?.commit?.sha) throw Error('GitHub did not confirm the lesson publish commit')
    let indexCommit
    try { indexCommit = await savePublicIndex(lesson) }
    catch (error) {
      error.lessonCommitted = true
      throw error
    }
    let warning = ''
    if (draft.sha) {
      try { await deleteJson(filePaths.draft, draft.sha, `Remove published lesson draft: ${lesson.id}`, '') }
      catch { warning = 'Lesson was published, but its draft copy could not be removed.' }
    }
    return send(res, 200, { ok: true, status: 'published', lesson, commits: { lesson: result.commit.sha, index: indexCommit }, ...(warning ? { warning } : {}) })
  } catch (error) {
    if (error.lessonCommitted) return send(res, 502, { status: 'publishing_failed', partial: true, error: 'The lesson file was committed, but GitHub did not confirm the public lesson index. Retry publishing to finish.' })
    if (error.status === 409) return send(res, 409, { error: 'GitHub data changed during this update. Reload and try again.' })
    if (error.message?.startsWith('Select ') || error.message?.startsWith('Invalid lesson') || /required|under 180|900 KB/.test(error.message || '')) return send(res, 400, { error: error.message })
    fail(res, error)
  }
}
