import { useEffect, useMemo, useState } from 'react'
import { CKEditor } from '@ckeditor/ckeditor5-react'
import ClassicEditor from '@ckeditor/ckeditor5-build-classic'
import { BookOpen, Plus, Save, Upload, Trash2, RefreshCw } from 'lucide-react'
import { deleteLesson, getAdminLesson, getAdminLessons, publishLesson, saveLessonDraft } from '../../services/api.js'

const config = { licenseKey: import.meta.env.VITE_CKEDITOR_LICENSE_KEY || 'GPL', toolbar: { items: ['heading', '|', 'bold', 'italic', '|', 'bulletedList', 'numberedList', '|', 'insertTable', '|', 'undo', 'redo'] }, table: { contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'] } }
const blank = (catalog) => ({ classId: catalog.classes[0]?.id || '', subjectId: '', title: '', slug: '', content: '', createdAt: '' })

export default function LessonManager({ catalog, onNotice }) {
  const [lessons, setLessons] = useState([])
  const [form, setForm] = useState(() => blank(catalog))
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const classes = catalog.classes || []
  const subjects = useMemo(() => catalog.subjects.filter((subject) => subject.classId === form.classId), [catalog.subjects, form.classId])

  async function refresh() {
    setLoading(true)
    try { const data = await getAdminLessons(); setLessons(data.lessons || []) }
    catch (error) { onNotice(error.response?.data?.error || 'Could not load lesson records.') }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])
  useEffect(() => {
    if (!classes.some((item) => item.id === form.classId)) setForm((current) => ({ ...current, classId: classes[0]?.id || '', subjectId: '' }))
  }, [classes, form.classId])
  useEffect(() => {
    if (!subjects.some((item) => item.id === form.subjectId)) setForm((current) => ({ ...current, subjectId: subjects[0]?.id || '' }))
  }, [subjects, form.subjectId])

  function newLesson() { setForm(blank(catalog)); onNotice('New lesson form is ready.') }
  async function editLesson(lesson) {
    setBusy(true)
    try {
      const data = await getAdminLesson({ classSlug: lesson.classSlug, subjectId: lesson.subjectId, slug: lesson.slug })
      setForm({ classId: data.classId, subjectId: data.subjectId, title: data.title, slug: data.slug, content: data.content, createdAt: data.createdAt })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      onNotice(`Loaded “${data.title}” for editing.`)
    } catch (error) { onNotice(error.response?.data?.error || 'Could not load that lesson.') }
    finally { setBusy(false) }
  }
  function payload() {
    const cls = classes.find((item) => item.id === form.classId)
    return { classSlug: cls?.slug, subjectId: form.subjectId, title: form.title.trim(), slug: form.slug.trim(), content: form.content, createdAt: form.createdAt }
  }
  async function save(publish = false) {
    if (!form.classId || !form.subjectId || !form.title.trim() || !form.content.replace(/<[^>]*>/g, '').trim()) { onNotice('Choose a class and subject, then enter a title and lesson content.'); return }
    setBusy(true)
    onNotice(publish ? 'Publishing lesson to GitHub…' : 'Saving lesson draft to GitHub…')
    try {
      const result = publish ? await publishLesson(payload()) : await saveLessonDraft(payload())
      setForm((current) => ({ ...current, slug: result.lesson.slug, createdAt: result.lesson.createdAt }))
      onNotice(publish ? `Lesson published successfully. GitHub confirmed the lesson and public index commits.${result.warning ? ` ${result.warning}` : ''}` : `Lesson draft saved. Record: ${result.lesson.slug}`)
      await refresh()
    } catch (error) {
      onNotice(error.response?.data?.error || (error.response?.data?.partial ? 'The lesson file was committed, but the public list was not updated. Please publish again to finish.' : 'Could not save the lesson.'))
    } finally { setBusy(false) }
  }
  async function remove(lesson) {
    if (!window.confirm(`Delete “${lesson.title}” and its draft?`)) return
    setBusy(true)
    try {
      await deleteLesson({ classSlug: lesson.classSlug, subjectId: lesson.subjectId, slug: lesson.slug })
      if (form.slug === lesson.slug) setForm(blank(catalog))
      onNotice('Lesson and draft deleted from GitHub.')
      await refresh()
    } catch (error) { onNotice(error.response?.data?.error || 'Could not delete the lesson.') }
    finally { setBusy(false) }
  }

  return <div className="admin-page">
    <div className="admin-page-intro"><h2>Lesson management</h2><p>Write lessons by class and subject using CKEditor 5. Save work as a private draft or publish it for public reading.</p></div>
    <section className="admin-panel-card lesson-editor-card">
      <div className="admin-panel-title"><div><h3>{form.slug ? 'Edit lesson' : 'Create lesson'}</h3><p>Published lessons appear in the public Lessons section.</p></div><button className="admin-secondary" onClick={newLesson}><Plus size={15}/> New lesson</button></div>
      <div className="admin-editor-meta lesson-meta">
        <label>Class<select value={form.classId} onChange={(event) => setForm((current) => ({ ...current, classId: event.target.value, subjectId: '' }))}>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label>Subject<select value={form.subjectId} onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value }))}>{subjects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label>Lesson title<input value={form.title} maxLength={180} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Enter lesson title"/></label>
        <label>URL slug<input value={form.slug} readOnly={Boolean(form.slug)} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="Auto-generated when saved"/></label>
      </div>
      <label className="admin-editor-label">Lesson content</label>
      <div className="lesson-ck-editor"><CKEditor editor={ClassicEditor} config={config} data={form.content} onChange={(_, editor) => setForm((current) => ({ ...current, content: editor.getData() }))}/></div>
      <div className="admin-editor-footer lesson-editor-footer"><span className="admin-editor-state"><BookOpen size={14}/> Content is saved as HTML in GitHub JSON.</span><div><button className="admin-secondary" disabled={busy} onClick={() => save(false)}><Save size={15}/> Save draft</button><button className="admin-primary" disabled={busy} onClick={() => save(true)}><Upload size={15}/> Publish lesson</button></div></div>
    </section>
    <section className="admin-panel-card"><div className="admin-panel-title"><div><h3>Lessons</h3><p>Drafts are visible to administrators only; public pages show published lessons.</p></div><button className="admin-icon-button" title="Refresh lessons" disabled={loading} onClick={refresh}><RefreshCw size={15}/></button></div><div className="admin-table-wrap"><table><thead><tr><th>Lesson</th><th>Class</th><th>Subject</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{lessons.map((lesson) => <tr key={lesson.id}><td><strong>{lesson.title}</strong></td><td>{lesson.className}</td><td>{lesson.subjectName}</td><td><span className={`admin-badge ${lesson.storageStatus}`}>{lesson.storageStatus}{lesson.storageStatus === 'draft' && lesson.hasPublished ? ' update' : ''}</span></td><td>{lesson.updatedAt ? new Date(lesson.updatedAt).toLocaleDateString() : '—'}</td><td className="admin-actions"><button onClick={() => editLesson(lesson)} disabled={busy}>Edit</button><button title="Delete lesson" onClick={() => remove(lesson)} disabled={busy}><Trash2 size={14}/></button></td></tr>)}{loading && <tr><td colSpan="6" className="admin-empty">Loading lessons…</td></tr>}{!loading && lessons.length === 0 && <tr><td colSpan="6" className="admin-empty">No lessons yet. Add the first lesson above.</td></tr>}</tbody></table></div></section>
  </div>
}
