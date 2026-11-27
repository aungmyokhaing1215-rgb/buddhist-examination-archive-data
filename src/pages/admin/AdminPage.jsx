import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, LayoutDashboard, School, Library, FileText, Search, Database, LogOut, Plus, Upload, Download, Trash2, ArrowUp, ArrowDown, Eye, Edit3, LockKeyhole, RefreshCw } from 'lucide-react'
import '../../schema.css'
import './admin.css'
import { adminLogin, adminLogout, getSession, getAdminCatalog, saveClass, getAdminDashboard, searchAdmin, getAdminExam, saveExam, publishExam, saveSubject, deleteExam, exportArchive, importCatalog, validateArchive } from '../../services/api.js'

const ManualExamEditor = lazy(() => import('./ManualExamEditor.jsx'))
const LessonManager = lazy(() => import('./LessonManager.jsx'))

const questionTypes = ['short_answer', 'long_answer', 'multiple_choice', 'fill_blank', 'true_false', 'matching', 'essay', 'translation', 'other']
const years = Array.from({ length: 27 }, (_, index) => 2000 + index)
const navItems = [
  ['dashboard', 'Dashboard', LayoutDashboard], ['classes', 'Classes', School], ['subjects', 'Subjects', Library],
  ['exams', 'Examinations', FileText], ['lessons', 'Lessons', BookOpen], ['search', 'Question search', Search], ['json', 'JSON tools', Database],
]

export default function AdminPage() {
  const navigate = useNavigate()
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [catalog, setCatalog] = useState({ classes: [], subjects: [] })
  const [view, setView] = useState('dashboard')
  const [notice, setNotice] = useState('')

  const refreshCatalog = useCallback(async () => setCatalog(await getAdminCatalog()), [])
  useEffect(() => { getSession().then((session) => setAuthenticated(session?.authenticated === true)).catch(() => setAuthenticated(false)).finally(() => setChecking(false)) }, [])
  useEffect(() => { if (authenticated) refreshCatalog().catch((error) => setNotice(error.response?.data?.error || 'Could not load archive settings.')) }, [authenticated, refreshCatalog])

  async function login(event) {
    event.preventDefault(); setLoginError('')
    try { await adminLogin(username, password); setUsername(''); setPassword(''); setAuthenticated(true) }
    catch (error) { setLoginError(error.response?.data?.error || 'Login failed. Check the administrator credentials and try again.') }
  }
  async function logout() { try { await adminLogout() } finally { setAuthenticated(false); navigate('/admin', { replace: true }) } }
  async function perform(action, success = 'Changes saved.') {
    try { const result = await action(); if (result?.classes) setCatalog(result); else if (result?.catalog) setCatalog(await getAdminCatalog()); setNotice(success); return result }
    catch (error) { setNotice(error.response?.data?.error || error.message || 'The change could not be saved.'); return null }
  }

  if (checking) return <div className="admin-loading">Loading administration…</div>
  if (!authenticated) return <div className="admin-login-wrap"><form className="admin-login" onSubmit={login}><span className="admin-login-icon"><LockKeyhole size={23}/></span><p className="admin-kicker">BUDDHIST EXAMINATION ARCHIVE</p><h1>Administrator login</h1><p>Sign in to manage classes, subjects, examinations and archive data.</p><label>Admin username<input autoFocus type="text" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label><label>Admin password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{loginError && <div className="admin-error">{loginError}</div>}<button className="admin-primary">Sign in <LockKeyhole size={16}/></button><Link to="/" className="admin-back">← Back to archive</Link></form></div>

  const selected = navItems.find(([key]) => key === view)
  return <div className="admin-app">
    <aside className="admin-side"><Link to="/" className="admin-brand"><span><BookOpen size={21}/></span><strong>Buddhist Examination Archive<small>Content administration</small></strong></Link><div className="admin-side-label">WORKSPACE</div><nav>{navItems.map(([key, label, Icon]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => { setView(key); setNotice('') }}><Icon size={17}/>{label}</button>)}</nav><div className="admin-side-bottom"><Link to="/">← View public archive</Link><button onClick={logout}><LogOut size={16}/> Sign out</button></div></aside>
    <main className="admin-workspace"><header className="admin-header"><div><div className="admin-breadcrumb">Administration <span>/</span> {selected?.[1]}</div><h1>{selected?.[1]}</h1></div><div className="admin-header-right"><span className="admin-status-dot">Signed in</span><button title="Refresh catalog" onClick={() => refreshCatalog().then(() => setNotice('Archive data refreshed.'))}><RefreshCw size={16}/></button><button title="Sign out" onClick={logout}><LogOut size={16}/></button></div></header>
      {notice && <div className="admin-notice" role="status">{notice}<button aria-label="Dismiss" onClick={() => setNotice('')}>×</button></div>}
      {view === 'dashboard' && <Dashboard onNavigate={setView}/>}
      {view === 'classes' && <ClassesPage classes={catalog.classes} onSave={(x) => perform(() => saveClass(x), 'Class list updated.')} />}
      {view === 'subjects' && <SubjectsPage catalog={catalog} onSave={(x) => perform(async () => { const result = await saveSubject(x); await refreshCatalog(); return result }, 'Subject list updated.')} />}
      {view === 'exams' && <Suspense fallback={<div className="admin-loading" role="status">Loading examination editor…</div>}><ManualExamEditor catalog={catalog} onNotice={setNotice} /></Suspense>}
      {view === 'lessons' && <Suspense fallback={<div className="admin-loading" role="status">Loading lesson editor…</div>}><LessonManager catalog={catalog} onNotice={setNotice}/></Suspense>}
      {view === 'search' && <AdminSearch catalog={catalog} onEdit={async (row) => {
        if (row.deleteExam) {
          if (!window.confirm(`Delete ${row.title}? This removes its published file and draft.`)) return
          await perform(() => deleteExam({ classSlug: row.classSlug, year: row.year, subjectId: row.subjectId }), 'Examination and search entries deleted.')
          return
        }
        if (row.deleteQuestion) {
          try {
            const exam = await getAdminExam({ classSlug: row.classSlug, year: row.year, subjectId: row.subjectId })
            const sections = exam.sections.map((section) => ({ ...section, questions: section.questions.filter((question) => question.id !== row.questionId).map((question, index) => ({ ...question, number: index + 1, order: index + 1 })) }))
            const updated = { ...exam, classSlug: row.classSlug, sections }
            await saveExam(updated)
            if (row.status === 'published') await publishExam(updated)
            setNotice(`Question ${row.questionNumber} deleted and the examination updated.`)
          } catch (error) { setNotice(error.response?.data?.error || 'Could not delete the question.') }
          return
        }
        await navigateToQuestion(row, setView, setNotice)
      }} />}
      {view === 'json' && <JsonTools onNotice={setNotice} onRestore={refreshCatalog}/>}
    </main>
  </div>
}

async function navigateToQuestion(row, setView, setNotice) {
  try {
    const exam = await getAdminExam({ classSlug: row.classSlug, year: row.year, subjectId: row.subjectId })
    sessionStorage.setItem('archive-admin-exam', JSON.stringify({ ...exam, classSlug: row.classSlug, focusQuestion: row.questionId || '', focusAnswer: Boolean(row.focusAnswer) }))
    setView('exams'); setNotice(`Loaded Question ${row.questionNumber} for editing.`)
  } catch (error) { setNotice(error.response?.data?.error || 'Could not open the selected examination.') }
}

function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { getAdminDashboard().then((data) => { if (!data || !Array.isArray(data.recentlyUpdated)) throw Error('Dashboard response was incomplete.'); setStats(data) }).catch((e) => setError(e.response?.data?.error || e.message || 'Dashboard data is unavailable.')) }, [])
  const cards = [['Total classes', stats?.totalClasses], ['Total subjects', stats?.totalSubjects], ['Examinations', stats?.totalExaminations], ['Questions', stats?.totalQuestions], ['Published', stats?.publishedExaminations], ['Drafts', stats?.draftExaminations]]
  const recentExams = Array.isArray(stats?.recentlyUpdated) ? stats.recentlyUpdated : []
  return <div className="admin-page"><div className="admin-welcome"><div><p className="admin-kicker">ARCHIVE OVERVIEW</p><h2>Manage the examination archive</h2><p>Update catalog details, maintain question and answer content, and publish verified examination files.</p></div><button className="admin-primary" onClick={() => onNavigate('exams')}><Plus size={17}/> Create examination</button></div>{error && <p className="admin-error">{error}</p>}<div className="admin-stat-grid">{cards.map(([label, value]) => <div className="admin-stat" key={label}><span>{label}</span><strong>{value ?? '—'}</strong></div>)}</div><section className="admin-panel-card"><div className="admin-panel-title"><div><h3>Recently updated examinations</h3><p>Latest drafts and published content from GitHub storage.</p></div><button className="admin-text-button" onClick={() => onNavigate('search')}>Search archive →</button></div><div className="admin-table-wrap"><table><thead><tr><th>Examination</th><th>Class</th><th>Year</th><th>Subject</th><th>Status</th><th>Updated</th></tr></thead><tbody>{recentExams.map((item) => <tr key={`${item.id}-${item.status}`}><td><strong>{item.title || item.id}</strong></td><td>{item.className}</td><td>{item.year}</td><td>{item.subjectName}</td><td><span className={`admin-badge ${item.status}`}>{item.status}</span></td><td>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'}</td></tr>)}{stats && recentExams.length === 0 && <tr><td colSpan="6" className="admin-empty">No examinations have been added yet.</td></tr>}{!stats && !error && <tr><td colSpan="6" className="admin-empty">Loading archive statistics…</td></tr>}</tbody></table></div></section></div>
}

function ClassesPage({ classes, onSave }) {
  const [newName, setNewName] = useState(''), [newSlug, setNewSlug] = useState('')
  const [editId, setEditId] = useState(''), [editName, setEditName] = useState('')
  return <div className="admin-page"><div className="admin-page-intro"><h2>Class management</h2><p>Manage the five archive classes and add additional categories when needed.</p></div><form className="admin-inline-form" onSubmit={(e) => { e.preventDefault(); if (newName.trim() && newSlug.trim()) onSave({ action: 'add', name: newName.trim(), slug: newSlug.trim().toLowerCase().replace(/\s+/g, '-') }).then?.(() => {}); setNewName(''); setNewSlug('') }}><input placeholder="New class name" value={newName} onChange={(e) => setNewName(e.target.value)}/><input placeholder="url-slug" value={newSlug} onChange={(e) => setNewSlug(e.target.value)}/><button className="admin-primary" type="submit"><Plus size={16}/> Add class</button></form><div className="admin-panel-card"><div className="admin-table-wrap"><table><thead><tr><th>Order</th><th>Class</th><th>Slug</th><th>Status</th><th>Actions</th></tr></thead><tbody>{[...classes].sort((a,b) => a.order-b.order).map((item, index) => <tr key={item.id}><td>{item.order}</td><td>{editId === item.id ? <form className="admin-edit-inline" onSubmit={(e) => { e.preventDefault(); onSave({ action: 'edit', classId: item.id, name: editName }); setEditId('') }}><input value={editName} onChange={(e) => setEditName(e.target.value)}/><button className="admin-small-primary">Save</button></form> : item.name}</td><td><code>{item.slug}</code></td><td><span className={`admin-badge ${item.status}`}>{item.status}</span></td><td className="admin-actions"><button title="Move up" disabled={!index} onClick={() => onSave({ action: 'move', classId: item.id, direction: -1 })}><ArrowUp size={15}/></button><button title="Move down" disabled={index === classes.length-1} onClick={() => onSave({ action: 'move', classId: item.id, direction: 1 })}><ArrowDown size={15}/></button><button title="Edit" onClick={() => { setEditId(item.id); setEditName(item.name) }}><Edit3 size={15}/></button><button onClick={() => onSave({ action: 'toggle', classId: item.id })}>{item.status === 'active' ? 'Deactivate' : 'Activate'}</button><button title="Delete" onClick={() => window.confirm(`Delete class “${item.name}”?`) && onSave({ action: 'delete', classId: item.id })}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div></div></div>
}

function SubjectsPage({ catalog, onSave }) {
  const [classId, setClassId] = useState(catalog.classes[0]?.id || ''), [name, setName] = useState('')
  const [editId, setEditId] = useState(''), [editName, setEditName] = useState('')
  useEffect(() => { if (!catalog.classes.some((item) => item.id === classId)) setClassId(catalog.classes[0]?.id || '') }, [catalog.classes, classId])
  const cls = catalog.classes.find((item) => item.id === classId)
  const subjects = catalog.subjects.filter((item) => item.classId === classId).sort((a,b) => a.order-b.order)
  return <div className="admin-page"><div className="admin-page-intro"><h2>Subject management</h2><p>Subjects are assigned to a class and can be reordered, activated or removed.</p></div><div className="admin-filter-row"><label>Class<select value={classId} onChange={(e) => setClassId(e.target.value)}>{catalog.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><form className="admin-inline-form" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onSave({ action: 'add', classSlug: cls?.slug, name: name.trim() }); setName('') } }}><input placeholder="New subject name" value={name} onChange={(e) => setName(e.target.value)}/><button className="admin-primary"><Plus size={16}/> Add subject</button></form><div className="admin-panel-card"><div className="admin-table-wrap"><table><thead><tr><th>Order</th><th>Subject</th><th>Slug</th><th>Status</th><th>Actions</th></tr></thead><tbody>{subjects.map((subject,index) => <tr key={subject.id}><td>{subject.order}</td><td>{editId === subject.id ? <form className="admin-edit-inline" onSubmit={(e) => { e.preventDefault(); onSave({ action: 'edit', classSlug: cls?.slug, subjectId: subject.id, name: editName }); setEditId('') }}><input value={editName} onChange={(e) => setEditName(e.target.value)}/><button className="admin-small-primary">Save</button></form> : subject.name}</td><td><code>{subject.slug}</code></td><td><span className={`admin-badge ${subject.status}`}>{subject.status}</span></td><td className="admin-actions"><button disabled={!index} onClick={() => onSave({ action: 'move', classSlug: cls?.slug, subjectId: subject.id, direction: -1 })}><ArrowUp size={15}/></button><button disabled={index===subjects.length-1} onClick={() => onSave({ action: 'move', classSlug: cls?.slug, subjectId: subject.id, direction: 1 })}><ArrowDown size={15}/></button><button onClick={() => { setEditId(subject.id); setEditName(subject.name) }}><Edit3 size={15}/></button><button onClick={() => onSave({ action: 'toggle', classSlug: cls?.slug, subjectId: subject.id })}>{subject.status === 'active' ? 'Deactivate' : 'Activate'}</button><button onClick={() => window.confirm(`Delete ${subject.name} and its exams/drafts?`) && onSave({ action: 'delete', classSlug: cls?.slug, subjectId: subject.id })}><Trash2 size={15}/></button></td></tr>)}{!subjects.length && <tr><td colSpan="5" className="admin-empty">No subjects for this class. Add the first one above.</td></tr>}</tbody></table></div></div></div>
}



function AdminSearch({ catalog, onEdit }) {
  const [filters, setFilters] = useState({ query:'', classId:'', year:'', subjectId:'', status:'', type:'', questionNumber:'', title:'' })
  const [page, setPage] = useState(1), [result, setResult] = useState({ results:[], total:0, page:1, pageSize:20 }), [busy, setBusy] = useState(false), [searched, setSearched] = useState(false), [error, setError] = useState('')
  const subjects = catalog.subjects.filter((item) => !filters.classId || item.classId === filters.classId)
  async function search(nextPage = 1, values = filters) { setBusy(true); setError(''); setSearched(true); try { const data = await searchAdmin({ ...values, page:nextPage, pageSize:20 }); setResult(data); setPage(nextPage) } catch (e) { setError(e.response?.data?.error || 'Search failed.') } finally { setBusy(false) } }
  function clear() { const empty = { query:'', classId:'', year:'', subjectId:'', status:'', type:'', questionNumber:'', title:'' }; setFilters(empty); setPage(1); search(1,empty) }
  return <div className="admin-page"><div className="admin-page-intro"><h2>Search questions and answers</h2><p>Search published records and drafts. Open a result to edit that exact question.</p></div><form className="admin-search-panel" onSubmit={(e) => { e.preventDefault(); search(1) }}><label className="admin-search-wide">Text search<input placeholder="Question, answer, keywords…" value={filters.query} onChange={(e) => setFilters({ ...filters, query:e.target.value })}/></label><label>Class<select value={filters.classId} onChange={(e) => setFilters({ ...filters, classId:e.target.value, subjectId:'' })}><option value="">All classes</option>{catalog.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Year<select value={filters.year} onChange={(e) => setFilters({ ...filters, year:e.target.value })}><option value="">All years</option>{years.slice().reverse().map((year) => <option key={year}>{year}</option>)}</select></label><label>Subject<select value={filters.subjectId} onChange={(e) => setFilters({ ...filters, subjectId:e.target.value })}><option value="">All subjects</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Status<select value={filters.status} onChange={(e) => setFilters({ ...filters, status:e.target.value })}><option value="">All</option><option value="published">Published</option><option value="draft">Draft</option></select></label><label>Question type<select value={filters.type} onChange={(e) => setFilters({ ...filters, type:e.target.value })}><option value="">All types</option>{questionTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label>Question no.<input type="number" min="1" value={filters.questionNumber} onChange={(e) => setFilters({ ...filters, questionNumber:e.target.value })}/></label><label>Exam title<input value={filters.title} onChange={(e) => setFilters({ ...filters, title:e.target.value })}/></label><div className="admin-search-actions"><button className="admin-primary" disabled={busy}><Search size={16}/> Search</button><button type="button" className="admin-secondary" onClick={clear}>Clear filters</button></div></form>{error && <p className="admin-error">{error}</p>}<div className="admin-results-heading"><strong>{busy ? 'Searching…' : `${result.total} result${result.total===1?'':'s'}`}</strong><span>Page {page}</span></div><div className="admin-result-list">{result.results.map((row) => <article className="admin-search-result" key={`${row.examId}-${row.questionId}`}><div className="admin-result-meta"><strong>{row.className} · {row.year} · {row.subjectName}</strong><span className={`admin-badge ${row.status}`}>{row.status}</span></div><h3>{row.title} <small>Question {row.questionNumber} · {row.questionType}</small></h3><div><b>Question</b><p>{row.questionText || '—'}</p></div><div><b>Answer</b><p>{row.answerText || '—'}</p></div><div className="admin-result-actions"><button className="admin-secondary" onClick={() => onEdit({ ...row, editExam:true, questionId:"" })}><Edit3 size={15}/> Edit examination</button><button className="admin-secondary" onClick={() => onEdit(row)}><Edit3 size={15}/> Edit question</button><button className="admin-secondary" onClick={() => onEdit({ ...row, focusAnswer:true })}><Edit3 size={15}/> Edit answer</button><Link className="admin-text-button" to={`/exam/${row.classSlug}/${row.year}/${row.subjectId}#question-${row.questionId}`}><Eye size={15}/> Open public exam</Link><button className="admin-danger-button" onClick={() => window.confirm(`Delete Question ${row.questionNumber}?`) && onEdit({ ...row, deleteQuestion:true })}><Trash2 size={15}/> Delete question</button><button className="admin-danger-button" onClick={() => onEdit({ ...row, deleteExam:true })}><Trash2 size={15}/> Delete examination</button></div></article>)}{searched && !busy && !result.results.length && <div className="admin-empty-card">No questions matched. Try a shorter search or clear some filters.</div>}{!searched && <div className="admin-empty-card">Enter a keyword or select filters, then search the full archive.</div>}</div><div className="admin-pagination"><button className="admin-secondary" disabled={page<=1||busy} onClick={() => search(page-1)}>Previous</button><span>{result.total ? `${(page-1)*result.pageSize+1}–${Math.min(page*result.pageSize,result.total)} of ${result.total}` : '0 results'}</span><button className="admin-secondary" disabled={page*result.pageSize>=result.total||busy} onClick={() => search(page+1)}>Next</button></div></div>
}

function JsonTools({ onNotice, onRestore }) {
  const [backup, setBackup] = useState(null), [filename, setFilename] = useState(''), [busy, setBusy] = useState(false), [validation, setValidation] = useState(null)
  async function download() { setBusy(true); try { const data = await exportArchive(); const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})); const anchor = document.createElement('a'); anchor.href=url; anchor.download='buddhist-examination-backup.json'; anchor.click(); URL.revokeObjectURL(url); onNotice('JSON backup downloaded from GitHub.') } catch (e) { onNotice(e.response?.data?.error || 'Backup download failed.') } finally { setBusy(false) } }
  async function select(file) { if (!file) return; setFilename(file.name); setValidation(null); setBusy(true); try { const data = JSON.parse(await file.text()); if (!Array.isArray(data.classes)||!Array.isArray(data.subjects)||!data.exams||typeof data.exams!=='object') throw Error('Backup must include classes, subjects, and exams.'); setBackup(data); const result = await validateArchive(data); setValidation(result); onNotice('JSON structure and examination records validated by the server.') } catch (e) { setValidation({ valid:false, error:e.response?.data?.error || e.message }); onNotice(`Backup validation failed: ${e.response?.data?.error || e.message}`) } finally { setBusy(false) } }
  async function restore() { if (!backup || !validation?.valid || !window.confirm('Restore this backup to GitHub? This replaces the current classes, subjects, examinations, lessons and drafts.')) return; setBusy(true); try { await importCatalog(backup); await onRestore(); setBackup(null); setValidation(null); setFilename(''); onNotice('Archive backup restored. Examination and lesson indexes regenerated.') } catch (e) { onNotice(e.response?.data?.error || 'Restore failed. The current archive was not confirmed as restored.') } finally { setBusy(false) } }
  return <div className="admin-page"><div className="admin-page-intro"><h2>JSON management</h2><p>GitHub is the permanent archive source. Create a backup or validate and restore a JSON archive file.</p></div><div className="admin-json-grid"><section className="admin-panel-card admin-json-card"><span className="admin-json-icon"><Download size={21}/></span><h3>Export archive backup</h3><p>Download class, subject, examination, lesson, draft and search-index JSON from GitHub.</p><button className="admin-primary" disabled={busy} onClick={download}><Download size={16}/> Download backup JSON</button></section><section className="admin-panel-card admin-json-card"><span className="admin-json-icon"><Upload size={21}/></span><h3>Validate and restore</h3><p>Preview backup contents first. Examination and lesson records are validated on the server before GitHub is updated.</p><label className="admin-file-select">Choose JSON file<input type="file" accept="application/json,.json" onChange={(e) => select(e.target.files?.[0])}/></label>{filename && <div className="admin-file-name">{filename}</div>}{backup && <div className="admin-json-preview"><strong>{validation?.valid ? 'Valid archive preview' : 'Archive preview'}</strong><span>{validation?.summary?.classes ?? backup.classes.length} classes</span><span>{validation?.summary?.subjects ?? backup.subjects.length} subjects</span><span>{validation?.summary ? `${validation.summary.published} exams · ${validation.summary.drafts} exam drafts · ${validation.summary.lessons || 0} lessons · ${validation.summary.lessonDrafts || 0} lesson drafts · ${validation.summary.questions} questions` : `${Object.keys(backup.exams).length} exams · ${Object.keys(backup.drafts||{}).length} exam drafts · ${Object.keys(backup.lessons||{}).length} lessons · ${Object.keys(backup.lessonDrafts||{}).length} lesson drafts`}</span>{validation?.error && <span className="admin-error">{validation.error}</span>}</div>}<button className="admin-primary" disabled={!backup||!validation?.valid||busy} onClick={restore}><RefreshCw size={16}/> Restore backup</button></section></div><div className="admin-warning-note">Restoring replaces current archive data. The server validates class and subject references, examination structure and lesson content, then regenerates both public indexes.</div></div>
}
