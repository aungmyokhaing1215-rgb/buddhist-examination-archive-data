import { isAdmin } from '../../_lib/auth.js'
import { readSource } from '../../_lib/data.js'
import { readJson, treeFiles } from '../../_lib/github.js'
import { send, method, fail } from '../../_lib/http.js'

const countQuestions = (exam) => (exam.sections || []).reduce((total, section) => total + (section.questions || []).length, 0)
export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return
  if (!await isAdmin(req)) return send(res, 401, { error: 'Authentication required' })
  try {
    const [classes, subjects, index, publishedPaths, draftPaths] = await Promise.all([readSource('classes'), readSource('subjects'), readSource('index'), treeFiles(), treeFiles('drafts', '')])
    let draftCount = 0, draftQuestions = 0
    const draftIds = new Set()
    const recent = []
    for (const entry of index.data) recent.push({ id: entry.id, className: entry.className, year: entry.year, subjectName: entry.subjectName, title: entry.title, status: 'published', updatedAt: entry.publishedAt || '' })
    for (const path of draftPaths) {
      const file = await readJson(path, '')
      if (!file.data) continue
      draftCount += 1
      draftIds.add(file.data.id)
      draftQuestions += countQuestions(file.data)
      recent.push({ id: file.data.id, className: classes.data.find((item) => item.id === file.data.classId)?.name || file.data.classId, year: file.data.year, subjectName: file.data.subjectName, title: file.data.title, status: 'draft', updatedAt: file.data.updatedAt || '' })
    }
    const publishedQuestions = index.data.reduce((total, exam) => total + (exam.sections || []).reduce((n, section) => n + (section.questions || []).length, 0), 0)
    recent.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    const publishedIds = new Set(index.data.map((item) => item.id))
    const totalExaminations = new Set([...publishedIds, ...draftIds]).size
    return send(res, 200, { totalClasses: classes.data.length, totalSubjects: subjects.data.length, totalExaminations, totalQuestions: publishedQuestions + draftQuestions, publishedExaminations: index.data.length, draftExaminations: draftCount, recentlyUpdated: recent.slice(0, 8) })
  } catch (error) { fail(res, error) }
}
