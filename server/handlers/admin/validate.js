import { isAdmin } from '../../_lib/auth.js'
import { calculateAndValidateExam } from '../../_lib/data.js'
import { send, method, body } from '../../_lib/http.js'

const core = ['primary', 'first-level', 'first-middle', 'first-high', 'dhammacariya']
const slugPattern = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/
function validateLessonMap(map, prefix, classes, subjects, expectedStatus) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) throw Error('Lesson backup data must be an object.')
  let count = 0
  for (const [path, lesson] of Object.entries(map)) {
    const match = path.match(new RegExp(`^${prefix}/([A-Za-z0-9-]+)/([a-z0-9-]+)/([a-z0-9-]+)\\.json$`))
    if (!match) throw Error(`Invalid lesson JSON path: ${path}`)
    const [, classSlug, subjectSlug, slug] = match
    const cls = classes.find((item) => item.slug === classSlug)
    const subject = subjects.find((item) => item.classId === cls?.id && item.slug === subjectSlug)
    if (!cls || !subject || !lesson || lesson.id !== `${cls.id}-${subject.id}-${slug}` || lesson.classId !== cls.id || lesson.classSlug !== classSlug || lesson.subjectId !== subject.id || lesson.subjectSlug !== subjectSlug || lesson.slug !== slug || slug.length > 80 || !String(lesson.title || '').trim() || lesson.title.length > 180 || typeof lesson.content !== 'string' || Buffer.byteLength(lesson.content, 'utf8') > 900000 || lesson.status !== expectedStatus) throw Error(`Invalid lesson data in ${path}`)
    if (!lesson.content.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim()) throw Error(`Lesson content is missing in ${path}`)
    count += 1
  }
  return count
}
export function validateBackup(input) {
  if (!Array.isArray(input.classes) || !Array.isArray(input.subjects) || !input.exams || typeof input.exams !== 'object' || Array.isArray(input.exams)) throw Error('Backup must contain classes, subjects, and exams.')
  const ids = new Set(), slugs = new Set()
  for (const item of input.classes) {
    if (!item || !item.id || item.id !== item.slug || !slugPattern.test(item.slug) || !String(item.name || '').trim() || !Number.isInteger(item.order) || !['active', 'inactive'].includes(item.status) || ids.has(item.id) || slugs.has(item.slug)) throw Error('Class data has missing, invalid or duplicate values.')
    ids.add(item.id); slugs.add(item.slug)
  }
  if (core.some((slug) => !ids.has(slug))) throw Error('Backup is missing one or more required archive classes.')
  const subjectIds = new Set(), subjectKeys = new Set()
  for (const item of input.subjects) {
    const key = `${item?.classId}:${item?.slug}`
    if (!item || !ids.has(item.classId) || !item.id || !slugPattern.test(item.slug) || !String(item.name || '').trim() || !Number.isInteger(item.order) || !['active', 'inactive'].includes(item.status) || subjectIds.has(item.id) || subjectKeys.has(key)) throw Error('Subject data has missing, invalid or duplicate values.')
    subjectIds.add(item.id); subjectKeys.add(key)
  }
  const examIds = new Set()
  let published = 0, drafts = 0, questions = 0
  for (const [path, raw] of Object.entries(input.exams)) {
    const match = path.match(/^exams\/([a-z0-9-]+)\/(20\d\d)\/([a-z0-9-]+)\.json$/)
    if (!match) throw Error(`Invalid published examination path: ${path}`)
    const [, classSlug, year, subjectSlug] = match
    const cls = input.classes.find((item) => item.slug === classSlug)
    const subject = input.subjects.find((item) => item.classId === cls?.id && item.slug === subjectSlug)
    if (!cls || !subject || raw.status !== 'published') throw Error(`Invalid class, subject or status in ${path}`)
    const exam = calculateAndValidateExam(raw, { classId: cls.id, year, subjectId: subject.id, subjectName: subject.name })
    if (examIds.has(exam.id)) throw Error(`Duplicate examination ID: ${exam.id}`)
    examIds.add(exam.id); published += 1; questions += exam.sections.reduce((n, section) => n + section.questions.length, 0)
  }
  for (const [path, raw] of Object.entries(input.drafts || {})) {
    const match = path.match(/^drafts\/([a-z0-9-]+)\/(20\d\d)\/([a-z0-9-]+)\.json$/)
    if (!match) throw Error(`Invalid draft path: ${path}`)
    const [, classSlug, year, subjectSlug] = match
    const cls = input.classes.find((item) => item.slug === classSlug)
    const subject = input.subjects.find((item) => item.classId === cls?.id && item.slug === subjectSlug)
    if (!cls || !subject) throw Error(`Unknown class or subject in ${path}`)
    const exam = calculateAndValidateExam({ ...raw, status: 'draft' }, { classId: cls.id, year, subjectId: subject.id, subjectName: subject.name })
    if (examIds.has(exam.id)) throw Error(`Duplicate examination ID: ${exam.id}`)
    examIds.add(exam.id); drafts += 1; questions += exam.sections.reduce((n, section) => n + section.questions.length, 0)
  }
  const lessons = validateLessonMap(input.lessons || {}, 'lessons', input.classes, input.subjects, 'published')
  const lessonDrafts = validateLessonMap(input.lessonDrafts || {}, 'drafts/lessons', input.classes, input.subjects, 'draft')
  return { classes: input.classes.length, subjects: input.subjects.length, published, drafts, questions, lessons, lessonDrafts }
}
export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return
  if (!await isAdmin(req)) return send(res, 401, { error: 'Authentication required' })
  try { return send(res, 200, { valid: true, summary: validateBackup(body(req)) }) }
  catch (error) { return send(res, 400, { valid: false, error: error.message }) }
}
