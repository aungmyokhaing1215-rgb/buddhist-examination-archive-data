import { isAdmin, requireCsrf } from '../../_lib/auth.js'
import { readSource } from '../../_lib/data.js'
import { writeJson } from '../../_lib/github.js'
import { send, method, body, fail } from '../../_lib/http.js'

const requiredClasses = ['primary', 'first-level', 'first-middle', 'first-high', 'dhammacariya']
const validSlug = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value || '')

export default async function handler(req, res) {
  if (!method(req, res, ['GET', 'PUT'])) return
  if (!await isAdmin(req)) return send(res, 401, { error: 'Authentication required' })
  if (req.method === 'PUT' && !await requireCsrf(req)) return send(res, 403, { error: 'CSRF validation failed' })
  try {
    const classesFile = await readSource('classes')
    const subjectsFile = await readSource('subjects')
    if (req.method === 'GET') return send(res, 200, { classes: classesFile.data, subjects: subjectsFile.data })
    const input = body(req)
    const classes = classesFile.data
    const action = input.action
    if (action === 'add') {
      const name = String(input.name || '').trim()
      const slug = String(input.slug || '').trim()
      if (!name || !validSlug(slug)) return send(res, 400, { error: 'Enter a class name and a lowercase URL slug.' })
      if (classes.some((item) => item.id === slug || item.slug === slug)) return send(res, 409, { error: 'That class already exists.' })
      classes.push({ id: slug, slug, name, order: classes.length + 1, status: 'active' })
    } else {
      const target = classes.find((item) => item.id === input.classId)
      if (!target) return send(res, 404, { error: 'Class not found.' })
      if (action === 'edit') {
        const name = String(input.name || '').trim()
        if (!name) return send(res, 400, { error: 'Class name is required.' })
        target.name = name
      } else if (action === 'move') {
        const from = classes.indexOf(target)
        const to = from + Number(input.direction)
        if (to >= 0 && to < classes.length) [classes[from], classes[to]] = [classes[to], classes[from]]
        classes.forEach((item, index) => { item.order = index + 1 })
      } else if (action === 'toggle') target.status = target.status === 'active' ? 'inactive' : 'active'
      else if (action === 'delete') {
        if (requiredClasses.includes(target.slug)) return send(res, 409, { error: 'The five archive classes are required and cannot be deleted.' })
        if (subjectsFile.data.some((subject) => subject.classId === target.id)) return send(res, 409, { error: 'Remove this class’s subjects before deleting the class.' })
        classes.splice(classes.indexOf(target), 1)
        classes.forEach((item, index) => { item.order = index + 1 })
      } else return send(res, 400, { error: 'Unknown class action.' })
    }
    await writeJson('classes.json', classes, `Manage archive classes: ${action}`, classesFile.sha)
    if (action === 'edit') {
      const indexFile = await readSource('index')
      const names = new Map(classes.map((item) => [item.id, item.name]))
      const nextIndex = indexFile.data.map((item) => ({ ...item, className: names.get(item.classId) || item.className }))
      if (JSON.stringify(nextIndex) !== JSON.stringify(indexFile.data)) await writeJson('index.json', nextIndex, 'Refresh class names in examination search index', indexFile.sha)
    }
    const updated = await readSource('classes')
    return send(res, 200, { ok: true, classes: updated.data, subjects: subjectsFile.data })
  } catch (error) { if (error.status === 409) return send(res, 409, { error: 'Archive changed elsewhere. Reload and retry.' }); fail(res, error) }
}
