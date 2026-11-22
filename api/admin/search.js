import { isAdmin } from '../_lib/auth.js'
import { readSource } from '../_lib/data.js'
import { readJson, treeFiles } from '../_lib/github.js'
import { send, method, fail } from '../_lib/http.js'

const text = (value) => String(value || '').normalize('NFC').toLocaleLowerCase()
const plain = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
function matches(exam, question, status, query, terms, filters) {
  if (filters.classId && filters.classId !== exam.classId) return false
  if (filters.year && String(filters.year) !== String(exam.year)) return false
  if (filters.subjectId && filters.subjectId !== exam.subjectId) return false
  if (filters.status && filters.status !== status) return false
  if (filters.title && !text(exam.title).includes(text(filters.title))) return false
  if (filters.questionNumber && String(filters.questionNumber) !== String(question.number)) return false
  if (filters.type && filters.type !== question.type) return false
  const haystack = text(`${exam.title} ${question.questionText || question.question} ${question.answerText || question.answer} ${(question.keywords || []).join(' ')}`)
  return !query || terms.every((term) => haystack.includes(term))
}
function addExamResults(results, exam, status, cls, subject, filters, query, terms) {
  for (const section of exam.sections || []) for (const question of section.questions || []) {
    if (!matches(exam, question, status, query, terms, filters)) continue
    results.push({ examId: exam.id, classId: exam.classId, className: exam.className || cls?.name || exam.classId, classSlug: cls?.slug || exam.classId, year: exam.year, subjectId: exam.subjectId, subjectName: exam.subjectName || subject?.name, title: exam.title, status, path: exam.path, sectionId: section.id, sectionTitle: section.title, questionId: question.id, questionNumber: question.number, questionType: question.type, questionText: plain(question.questionText || question.question), answerText: plain(question.answerText || question.answer), updatedAt: exam.publishedAt || exam.updatedAt || '' })
  }
}

export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return
  if (!await isAdmin(req)) return send(res, 401, { error: 'Authentication required' })
  try {
    const [classes, subjects, index, draftPaths] = await Promise.all([readSource('classes'), readSource('subjects'), readSource('index'), treeFiles('drafts', '')])
    const classById = new Map(classes.data.map((item) => [item.id, item]))
    const subjectById = new Map(subjects.data.map((item) => [item.id, item]))
    const query = text(req.query.query).trim()
    const terms = query.split(/\s+/).filter(Boolean)
    const results = []
    if (!req.query.status || req.query.status === 'published') {
      for (const indexed of index.data) addExamResults(results, indexed, 'published', classById.get(indexed.classId), subjectById.get(indexed.subjectId), req.query, query, terms)
    }
    if (!req.query.status || req.query.status === 'draft') {
      for (const path of draftPaths) {
        const file = await readJson(path, '')
        if (file.data) addExamResults(results, file.data, 'draft', classById.get(file.data.classId), subjectById.get(file.data.subjectId), req.query, query, terms)
      }
    }
    results.sort((a, b) => b.year - a.year || a.questionNumber - b.questionNumber)
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 20))
    return send(res, 200, { results: results.slice((page - 1) * pageSize, page * pageSize), total: results.length, page, pageSize })
  } catch (error) { fail(res, error) }
}
