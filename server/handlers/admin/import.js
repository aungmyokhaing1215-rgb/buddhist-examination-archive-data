import { isAdmin, requireCsrf } from '../../_lib/auth.js'
import { readJson, writeJson, deleteJson, treeFiles } from '../../_lib/github.js'
import { readSource, calculateAndValidateExam, toIndexEntry } from '../../_lib/data.js'
import { validateBackup } from './validate.js'
import { send, method, body, fail } from '../../_lib/http.js'

const lessonMeta = (lesson) => ({ id: lesson.id, slug: lesson.slug, title: lesson.title, classId: lesson.classId, classSlug: lesson.classSlug, className: lesson.className, subjectId: lesson.subjectId, subjectSlug: lesson.subjectSlug, subjectName: lesson.subjectName, path: `public/data/lessons/${lesson.classSlug}/${lesson.subjectSlug}/${lesson.slug}.json`, updatedAt: lesson.updatedAt })
export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return
  if (!await isAdmin(req)) return send(res, 401, { error: 'Authentication required' })
  if (!await requireCsrf(req)) return send(res, 403, { error: 'CSRF validation failed' })
  try {
    const input = body(req)
    validateBackup(input)
    const published = [], drafts = [], lessons = [], lessonDrafts = [], index = []
    for (const [path, raw] of Object.entries(input.exams || {})) {
      const match = path.match(/^exams\/([a-z0-9-]+)\/(20\d\d)\/([a-z0-9-]+)\.json$/)
      const [, classSlug, year, subjectSlug] = match
      const cls = input.classes.find((item) => item.slug === classSlug)
      const subject = input.subjects.find((item) => item.classId === cls.id && item.slug === subjectSlug)
      const exam = calculateAndValidateExam(raw, { classId: cls.id, year, subjectId: subject.id, subjectName: subject.name })
      exam.status = 'published'; published.push({ path, exam }); index.push(toIndexEntry(exam, cls.name, path))
    }
    for (const [path, raw] of Object.entries(input.drafts || {})) {
      const match = path.match(/^drafts\/([a-z0-9-]+)\/(20\d\d)\/([a-z0-9-]+)\.json$/)
      const [, classSlug, year, subjectSlug] = match
      const cls = input.classes.find((item) => item.slug === classSlug)
      const subject = input.subjects.find((item) => item.classId === cls.id && item.slug === subjectSlug)
      drafts.push({ path, exam: calculateAndValidateExam({ ...raw, status: 'draft' }, { classId: cls.id, year, subjectId: subject.id, subjectName: subject.name }) })
    }
    for (const [path, lesson] of Object.entries(input.lessons || {})) lessons.push({ path, lesson })
    for (const [path, lesson] of Object.entries(input.lessonDrafts || {})) lessonDrafts.push({ path, lesson })

    const [oldClasses, oldSubjects, oldIndex, oldLessonIndex] = await Promise.all([readSource('classes'), readSource('subjects'), readSource('index'), readJson('lessons.json')])
    await writeJson('classes.json', input.classes, 'Restore archive classes', oldClasses.sha)
    await writeJson('subjects.json', input.subjects, 'Restore archive subjects', oldSubjects.sha)
    const includedExams = new Set()
    for (const { path, exam } of published) { const old = await readJson(path); await writeJson(path, exam, `Restore examination ${exam.id}`, old.sha); includedExams.add(path) }
    for (const { path, exam } of drafts) { const old = await readJson(path, ''); await writeJson(path, exam, `Restore draft ${exam.id}`, old.sha, ''); includedExams.add(path) }
    for (const path of await treeFiles()) if (!includedExams.has(path)) { const old = await readJson(path); if (old.sha) await deleteJson(path, old.sha) }
    for (const path of (await treeFiles('drafts', '')).filter((item) => !item.startsWith('drafts/lessons/'))) if (!includedExams.has(path)) { const old = await readJson(path, ''); if (old.sha) await deleteJson(path, old.sha, 'Remove draft absent from backup', '') }

    const includedLessons = new Set()
    for (const { path, lesson } of lessons) { const old = await readJson(path); await writeJson(path, lesson, `Restore lesson ${lesson.id}`, old.sha); includedLessons.add(path) }
    for (const { path, lesson } of lessonDrafts) { const old = await readJson(path, ''); await writeJson(path, lesson, `Restore lesson draft ${lesson.id}`, old.sha, ''); includedLessons.add(path) }
    for (const path of await treeFiles('lessons')) if (!includedLessons.has(path)) { const old = await readJson(path); if (old.sha) await deleteJson(path, old.sha) }
    for (const path of (await treeFiles('drafts', '')).filter((item) => item.startsWith('drafts/lessons/'))) if (!includedLessons.has(path)) { const old = await readJson(path, ''); if (old.sha) await deleteJson(path, old.sha, 'Remove lesson draft absent from backup', '') }
    const lessonIndex = lessons.map(({ lesson }) => lessonMeta(lesson)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    await writeJson('index.json', index, 'Regenerate examination search index after JSON restore', oldIndex.sha)
    await writeJson('lessons.json', lessonIndex, 'Regenerate public lesson index after JSON restore', oldLessonIndex.sha)
    return send(res, 200, { ok: true, examinations: includedExams.size, lessons: includedLessons.size, index: index.length })
  } catch (error) {
    if (error.status === 409) return send(res, 409, { error: 'Archive changed during restore. Retry with a fresh backup.' })
    if (error.message?.includes('must') || error.message?.includes('required') || error.message?.includes('unique') || error.message?.includes('Unsupported') || error.message?.includes('marks') || error.message?.includes('reference') || error.message?.includes('Question') || error.message?.includes('At least') || error.message?.includes('Invalid') || error.message?.includes('Unknown') || error.message?.includes('missing') || error.message?.includes('Lesson')) return send(res, 400, { error: error.message })
    return fail(res, error)
  }
}
