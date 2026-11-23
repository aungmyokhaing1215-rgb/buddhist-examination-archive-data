import { isAdmin, requireCsrf } from '../../_lib/auth.js'
import { readJson, writeJson, deleteJson } from '../../_lib/github.js'
import { readSource, examPath, calculateAndValidateExam, updateIndex } from '../../_lib/data.js'
import { send, method, body, fail } from '../../_lib/http.js'

export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return
  if (!await isAdmin(req)) return send(res, 401, { error: 'Authentication required' })
  if (!await requireCsrf(req)) return send(res, 403, { error: 'CSRF validation failed' })

  let examCommit
  let indexCommit
  try {
    const input = body(req)
    const [classes, subjects] = await Promise.all([readSource('classes'), readSource('subjects')])
    const cls = classes.data.find((item) => item.slug === input.classSlug && item.status === 'active')
    const subject = subjects.data.find((item) => item.classId === cls?.id && item.status === 'active' && (item.id === input.subjectId || item.slug === input.subjectId))
    if (!cls || !subject) return send(res, 400, { status: 'validation_failed', error: 'Select a valid active class and subject' })
    const year = Number(input.year)
    if (!Number.isInteger(year) || year < 2000 || year > 2026) return send(res, 400, { status: 'validation_failed', error: 'Year must be between 2000 and 2026' })

    const path = examPath(cls.slug, String(year), subject.slug)
    const draftPath = `drafts/${path.slice('exams/'.length)}`
    let draft = await readJson(draftPath, '')
    if (!draft.data) draft = await readJson(path)
    if (!draft.data) return send(res, 404, { status: 'validation_failed', error: 'Save an examination first' })

    let exam
    try {
      exam = calculateAndValidateExam({
        ...draft.data,
        id: `${cls.id}-${year}-${subject.slug}`,
        classId: cls.id,
        subjectId: subject.id,
        subjectName: subject.name,
        status: 'published',
      }, { classId: cls.id, subjectId: subject.id, subjectName: subject.name, year })
    } catch (error) {
      return send(res, 400, { status: 'validation_failed', error: error.message })
    }

    const previous = await readJson(path)
    const savedExam = await writeJson(path, exam, `Publish: ${cls.slug} ${year} ${subject.slug}`, previous.sha)
    examCommit = savedExam?.commit?.sha
    if (!examCommit) throw Error('GitHub did not confirm the examination commit')

    const indexed = await updateIndex(exam, cls.name, path)
    indexCommit = indexed.commit

    let draftWarning
    if (draft.sha) {
      try {
        const removed = await deleteJson(draftPath, draft.sha, `Remove published draft: ${exam.id}`, '')
        if (!removed?.commit?.sha) draftWarning = 'The published examination is committed, but GitHub did not confirm draft cleanup.'
      } catch {
        draftWarning = 'The published examination is committed, but the saved draft could not be removed.'
      }
    }

    return send(res, 200, {
      ok: true,
      status: 'published',
      totalMarks: exam.totalMarks,
      commits: { examination: examCommit, searchIndex: indexCommit },
      ...(draftWarning ? { warning: draftWarning } : {}),
    })
  } catch (error) {
    if (error.status === 409) return send(res, 409, { status: 'github_conflict', error: 'GitHub data changed during publishing. Reload and retry.', ...(examCommit ? { partial: true, commits: { examination: examCommit } } : {}) })
    if (examCommit) return send(res, 502, { status: 'publishing_failed', error: 'The examination was committed, but the search index could not be confirmed. Retry publishing to finish the index update.', partial: true, commits: { examination: examCommit, ...(indexCommit ? { searchIndex: indexCommit } : {}) } })
    if (error.status) return send(res, 502, { status: 'publishing_failed', error: `GitHub could not confirm publishing (request status ${error.status}). Retry after checking repository access and branch settings.` })
    fail(res, error)
  }
}
