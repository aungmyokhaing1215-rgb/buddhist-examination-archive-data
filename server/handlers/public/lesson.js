import { readJson } from '../../_lib/github.js'
import { readSource } from '../../_lib/data.js'
import { send, method, fail } from '../../_lib/http.js'

const validSlug = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ''))
export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return
  try {
    const { classSlug, subjectSlug, lessonSlug } = req.query
    if (classSlug && !validSlug(classSlug) || subjectSlug && !validSlug(subjectSlug) || lessonSlug && !validSlug(lessonSlug)) return send(res, 400, { error: 'Invalid lesson reference' })
    const [classes, subjects] = await Promise.all([readSource('classes'), readSource('subjects')])
    const cls = classes.data.find((item) => item.slug === classSlug && item.status === 'active')
    const subject = subjects.data.find((item) => item.classId === cls?.id && item.slug === subjectSlug && item.status === 'active')
    if (classSlug && !cls || subjectSlug && !subject) return send(res, 404, { error: 'Lesson not found' })
    if (lessonSlug) {
      if (!cls || !subject) return send(res, 404, { error: 'Lesson not found' })
      const { data } = await readJson(`lessons/${cls.slug}/${subject.slug}/${lessonSlug}.json`)
      if (!data || data.status !== 'published') return send(res, 404, { error: 'Lesson not found' })
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
      return send(res, 200, data)
    }
    const { data: index } = await readJson('lessons.json')
    const lessons = (Array.isArray(index) ? index : []).filter((item) => (!classSlug || item.classSlug === classSlug) && (!subjectSlug || item.subjectSlug === subjectSlug))
    lessons.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    return send(res, 200, { lessons })
  } catch (error) { fail(res, error) }
}
