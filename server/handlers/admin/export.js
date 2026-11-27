import { isAdmin } from '../../_lib/auth.js'
import { readJson, treeFiles } from '../../_lib/github.js'
import { readSource } from '../../_lib/data.js'
import { send, method, fail } from '../../_lib/http.js'

export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return
  if (!await isAdmin(req)) return send(res, 401, { error: 'Authentication required' })
  try {
    const [classes, subjects, index, examsPaths, draftPaths, lessonPaths, lessonDraftIndex] = await Promise.all([
      readSource('classes'), readSource('subjects'), readSource('index'), treeFiles(), treeFiles('drafts', ''),
      treeFiles('lessons'), readJson('lessons.json'),
    ])
    const exams = {}, drafts = {}, lessons = {}, lessonDrafts = {}
    for (const path of examsPaths) { const file = await readJson(path); if (file.data) exams[path] = file.data }
    for (const path of draftPaths.filter((item) => !item.startsWith('drafts/lessons/'))) { const file = await readJson(path, ''); if (file.data) drafts[path] = file.data }
    for (const path of lessonPaths) { const file = await readJson(path); if (file.data) lessons[path] = file.data }
    for (const path of draftPaths.filter((item) => item.startsWith('drafts/lessons/'))) { const file = await readJson(path, ''); if (file.data) lessonDrafts[path] = file.data }
    return send(res, 200, { schemaVersion: 3, classes: classes.data, subjects: subjects.data, index: index.data, exams, drafts, lessons, lessonDrafts, lessonsIndex: Array.isArray(lessonDraftIndex.data) ? lessonDraftIndex.data : [] })
  } catch (error) { return fail(res, error) }
}
