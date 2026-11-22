import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, GripVertical, Plus, Save, Trash2, Upload, X } from 'lucide-react'
import { CKEditor } from '@ckeditor/ckeditor5-react'
import ClassicEditor from '@ckeditor/ckeditor5-build-classic'
import DOMPurify from 'dompurify'
import { getAdminExam, publishExam, saveExam } from '../../services/api.js'

const years = Array.from({ length: 27 }, (_, index) => 2000 + index)
const questionTypes = ['short_answer', 'long_answer', 'multiple_choice', 'fill_blank', 'true_false', 'matching', 'essay', 'translation', 'other']
const symbols = ['π', '√', '∑', '∫', '∞', '≤', '≥', '≠', '×', '÷', '±', '∴', 'ṃ', 'ṅ']
const id = (prefix) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`
const blankQuestion = (number = 1) => ({ id: id('q'), number, type: 'long_answer', question: '', answer: '', marks: 0, order: number, keywords: [] })
const blankExam = () => ({ id: '', classId: '', classSlug: '', year: 2026, subjectId: '', subjectName: '', title: '', totalMarks: 0, status: 'draft', sections: [{ id: id('section'), title: 'Section 1', order: 1, marks: 0, questions: [blankQuestion()] }] })
const editorConfig = {
  licenseKey: import.meta.env.VITE_CKEDITOR_LICENSE_KEY || 'GPL',
  toolbar: { items: ['heading', '|', 'bold', 'italic', '|', 'bulletedList', 'numberedList', '|', 'insertTable', '|', 'undo', 'redo'] },
  table: { contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'] },
}
const safeHtml = (html) => DOMPurify.sanitize(html || '')

export default function ManualExamEditor({ catalog, onNotice }) {
  const [exam, setExam] = useState(blankExam)
  const [busy, setBusy] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const editorRefs = useRef(new Map())
  const dragRef = useRef(null)
  const classes = catalog.classes
  const selectedClass = classes.find((item) => item.id === exam.classId)
  const subjects = catalog.subjects.filter((item) => item.classId === exam.classId)
  const totalMarks = useMemo(() => exam.sections.reduce((total, section) => total + section.questions.reduce((sum, question) => sum + (Number(question.marks) || 0), 0), 0), [exam.sections])
  const orderedSections = useMemo(() => [...exam.sections].sort((a, b) => a.order - b.order).map((section) => ({ ...section, marks: section.questions.reduce((total, question) => total + (Number(question.marks) || 0), 0), questions: [...section.questions].sort((a, b) => a.number - b.number || a.order - b.order) })), [exam.sections])

  useEffect(() => {
    const cached = sessionStorage.getItem('archive-admin-exam')
    if (!cached) return
    try {
      const record = JSON.parse(cached)
      sessionStorage.removeItem('archive-admin-exam')
      setExam({ ...blankExam(), ...record, sections: normalizeSections(record.sections) })
    } catch { sessionStorage.removeItem('archive-admin-exam') }
  }, [])
  useEffect(() => {
    if (!exam.focusQuestion) return
    const target = exam.focusAnswer ? `admin-answer-${exam.focusQuestion}` : `admin-question-${exam.focusQuestion}`
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [exam.focusQuestion, exam.focusAnswer, exam.sections])

  function updateExam(changes) { setExam((current) => ({ ...current, ...changes })) }
  function updateSection(sectionIndex, changes) {
    setExam((current) => ({ ...current, sections: current.sections.map((section, index) => index === sectionIndex ? { ...section, ...changes } : section) }))
  }
  function updateQuestion(sectionIndex, questionIndex, changes) {
    setExam((current) => ({ ...current, sections: current.sections.map((section, si) => si === sectionIndex ? { ...section, questions: section.questions.map((question, qi) => qi === questionIndex ? { ...question, ...changes } : question) } : section) }))
  }
  function chooseClass(classId) {
    const selected = classes.find((item) => item.id === classId)
    setExam({ ...blankExam(), classId, classSlug: selected?.slug || '', year: exam.year })
  }
  function chooseSubject(subjectId) {
    const subject = subjects.find((item) => item.id === subjectId)
    setExam((current) => ({ ...current, subjectId, subjectName: subject?.name || '', title: subject ? `${current.year} ${subject.name}` : '', id: subject && selectedClass ? `${selectedClass.id}-${current.year}-${subject.slug}` : '' }))
  }
  async function load() {
    if (!selectedClass || !exam.subjectId) return
    setBusy(true)
    try {
      const data = await getAdminExam({ classSlug: selectedClass.slug, year: exam.year, subjectId: exam.subjectId })
      setExam({ ...blankExam(), ...data, classSlug: selectedClass.slug, sections: normalizeSections(data.sections) })
      onNotice('Examination loaded. Existing question and answer HTML is preserved.')
    } catch (error) {
      onNotice(error.response?.status === 404 ? 'No saved examination found. Fill in the details to create one.' : error.response?.data?.error || 'Could not load examination.')
    } finally { setBusy(false) }
  }
  async function save(publish = false) {
    if (!selectedClass || !exam.subjectId) { onNotice('Select a class and subject first.'); return }
    setBusy(true)
    if (publish) onNotice('Publishing examination and search index to GitHub…')
    try {
      const payload = { ...exam, classSlug: selectedClass.slug, year: Number(exam.year), totalMarks }
      const result = publish ? await publishExam(payload) : await saveExam(payload)
      setExam((current) => ({ ...current, totalMarks: result.totalMarks ?? totalMarks, status: publish ? 'published' : 'draft' }))
      onNotice(publish ? `Published successfully. GitHub confirmed both examination and search index commits.${result.warning ? ` ${result.warning}` : ''}` : 'Draft saved to GitHub.')
    } catch (error) {
      const response = error.response?.data
      onNotice(response?.status === 'github_conflict' ? response.error : response?.status === 'validation_failed' ? `Validation failed: ${response.error}` : response?.partial ? `Publishing incomplete: ${response.error} The examination file is already committed; retry to finish.` : response?.error || 'Could not save examination.')
    }
    finally { setBusy(false) }
  }
  function reorderQuestion(sourceSection, sourceIndex, targetSection, targetIndex) {
    const sections = exam.sections.map((section) => ({ ...section, questions: [...section.questions] }))
    const source = sections[sourceSection]
    const [question] = source?.questions.splice(sourceIndex, 1) || []
    if (!question || !sections[targetSection]) return
    sections[targetSection].questions.splice(Math.min(targetIndex, sections[targetSection].questions.length), 0, question)
    sections.forEach((section) => section.questions.forEach((item, index) => { item.order = index + 1; item.number = index + 1 }))
    setExam((current) => ({ ...current, sections }))
  }
  function reorderSection(from, to) {
    if (to < 0 || to >= exam.sections.length) return
    const sections = [...exam.sections]
    ;[sections[from], sections[to]] = [sections[to], sections[from]]
    sections.forEach((section, index) => { section.order = index + 1 })
    setExam((current) => ({ ...current, sections }))
  }
  function addSymbol(editorKey, symbol) {
    const editor = editorRefs.current.get(editorKey)
    editor?.model.change((writer) => writer.insertText(symbol, editor.model.document.selection))
  }
  function beginDrag(event, payload) {
    dragRef.current = payload
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', payload.kind)
  }
  function dropOnQuestion(event, sectionIndex, questionIndex) {
    event.preventDefault()
    event.stopPropagation()
    const source = dragRef.current
    if (source?.kind === 'question') reorderQuestion(source.sectionIndex, source.questionIndex, sectionIndex, questionIndex)
    dragRef.current = null
  }
  function dropOnSection(event, sectionIndex) {
    event.preventDefault()
    const source = dragRef.current
    if (source?.kind === 'section') reorderSection(source.sectionIndex, sectionIndex)
    if (source?.kind === 'question') reorderQuestion(source.sectionIndex, source.questionIndex, sectionIndex, exam.sections[sectionIndex].questions.length)
    dragRef.current = null
  }

  return <div className="admin-page">
    <div className="admin-page-intro"><h2>Manual examination entry</h2><p>Enter questions and answers directly. No document upload or extraction is used.</p></div>
    <section className="admin-panel-card admin-editor-card">
      <div className="admin-editor-meta">
        <label>Class<select value={exam.classId} onChange={(event) => chooseClass(event.target.value)}><option value="">Choose class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Year<select value={exam.year} onChange={(event) => updateExam({ year: Number(event.target.value) })}>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
        <label>Subject<select value={exam.subjectId} onChange={(event) => chooseSubject(event.target.value)}><option value="">Choose subject</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button className="admin-secondary" disabled={!selectedClass || !exam.subjectId || busy} onClick={load}>Load existing</button>
      </div>
      <div className="admin-editor-meta admin-editor-title"><label>Examination title<input value={exam.title} onChange={(event) => updateExam({ title: event.target.value })} placeholder="Examination title"/></label><div className="admin-editor-status"><span className={`admin-badge ${exam.status}`}>{exam.status}</span><strong>{totalMarks} marks</strong></div></div>

      <div className="admin-editor-sections">{exam.sections.map((section, sectionIndex) => <section className="admin-edit-section" key={section.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOnSection(event, sectionIndex)}>
        <header><button className="admin-drag-handle" title="Drag to reorder section" draggable onDragStart={(event) => beginDrag(event, { kind: 'section', sectionIndex })}><GripVertical size={17}/></button><input aria-label="Section title" value={section.title} onChange={(event) => updateSection(sectionIndex, { title: event.target.value })}/><span>{section.questions.reduce((sum, question) => sum + (Number(question.marks) || 0), 0)} marks</span><button className="admin-icon-button" title="Move section up" disabled={!sectionIndex} onClick={() => reorderSection(sectionIndex, sectionIndex - 1)}><ArrowUp size={15}/></button><button className="admin-icon-button" title="Move section down" disabled={sectionIndex === exam.sections.length - 1} onClick={() => reorderSection(sectionIndex, sectionIndex + 1)}><ArrowDown size={15}/></button><button className="admin-icon-button danger" title="Delete section" onClick={() => window.confirm(`Delete ${section.title} and its ${section.questions.length} question(s)?`) && setExam((current) => ({ ...current, sections: current.sections.filter((_, index) => index !== sectionIndex).map((item, index) => ({ ...item, order: index + 1 })) }))}><Trash2 size={15}/></button></header>
        {section.questions.map((question, questionIndex) => <article className="admin-edit-question" id={`admin-question-${question.id}`} key={question.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOnQuestion(event, sectionIndex, questionIndex)}>
          <div className="admin-q-meta"><button className="admin-drag-handle" title="Drag to reorder or move question" draggable onDragStart={(event) => beginDrag(event, { kind: 'question', sectionIndex, questionIndex })}><GripVertical size={16}/></button><label>Question no.<input type="number" min="1" step="1" value={question.number} onChange={(event) => updateQuestion(sectionIndex, questionIndex, { number: Number(event.target.value), order: Number(event.target.value) })}/></label><label>Type<select value={question.type} onChange={(event) => updateQuestion(sectionIndex, questionIndex, { type: event.target.value })}>{questionTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label>Marks<input type="number" min="0" step="0.5" value={question.marks} onChange={(event) => updateQuestion(sectionIndex, questionIndex, { marks: Number(event.target.value) })}/></label><label className="admin-move-question">Section<select value={sectionIndex} onChange={(event) => reorderQuestion(sectionIndex, questionIndex, Number(event.target.value), exam.sections[Number(event.target.value)]?.questions.length || 0)}>{exam.sections.map((item, index) => <option key={item.id} value={index}>{item.title}</option>)}</select></label><button className="admin-icon-button" title="Move question up" disabled={!questionIndex} onClick={() => reorderQuestion(sectionIndex, questionIndex, sectionIndex, questionIndex - 1)}><ArrowUp size={15}/></button><button className="admin-icon-button" title="Move question down" disabled={questionIndex === section.questions.length - 1} onClick={() => reorderQuestion(sectionIndex, questionIndex, sectionIndex, questionIndex + 1)}><ArrowDown size={15}/></button><button className="admin-icon-button danger" title="Delete question" onClick={() => window.confirm(`Delete Question ${question.number}?`) && updateSection(sectionIndex, { questions: section.questions.filter((_, index) => index !== questionIndex) })}><Trash2 size={15}/></button></div>
          <label className="admin-editor-label">Question content</label><SymbolBar editorKey={`${question.id}-question`} onInsert={addSymbol}/><CKEditor editor={ClassicEditor} config={editorConfig} data={question.question} onReady={(editor) => editorRefs.current.set(`${question.id}-question`, editor)} onChange={(_, editor) => updateQuestion(sectionIndex, questionIndex, { question: editor.getData() })}/>
          <label id={`admin-answer-${question.id}`} className="admin-editor-label">Answer content</label><SymbolBar editorKey={`${question.id}-answer`} onInsert={addSymbol}/><CKEditor editor={ClassicEditor} config={editorConfig} data={question.answer} onReady={(editor) => editorRefs.current.set(`${question.id}-answer`, editor)} onChange={(_, editor) => updateQuestion(sectionIndex, questionIndex, { answer: editor.getData() })}/>
          {question.type === 'multiple_choice' && <div className="admin-type-fields"><label>Choices, one per line<textarea value={(Array.isArray(question.options) ? question.options : []).map((option) => typeof option === 'object' ? option.text || JSON.stringify(option) : option).join('\n')} onChange={(event) => updateQuestion(sectionIndex, questionIndex, { options: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })}/></label><label>Correct choice<input value={question.correctAnswer || ''} onChange={(event) => updateQuestion(sectionIndex, questionIndex, { correctAnswer: event.target.value })}/></label></div>}
          {question.type === 'true_false' && <label className="admin-editor-label">Correct answer<select value={question.correctAnswer || ''} onChange={(event) => updateQuestion(sectionIndex, questionIndex, { correctAnswer: event.target.value })}><option value="">Choose answer</option><option value="true">True</option><option value="false">False</option></select></label>}
          {question.type === 'fill_blank' && <label className="admin-editor-label">Expected answer<input value={question.correctAnswer || ''} onChange={(event) => updateQuestion(sectionIndex, questionIndex, { correctAnswer: event.target.value })}/></label>}
          {question.type === 'matching' && <label className="admin-editor-label">Matching pairs (one left = right pair per line)<textarea value={(Array.isArray(question.pairs) ? question.pairs : []).map((pair) => `${pair.left || ''} = ${pair.right || ''}`).join('\n')} onChange={(event) => updateQuestion(sectionIndex, questionIndex, { pairs: event.target.value.split('\n').filter((line) => line.trim()).map((line) => { const [left, ...right] = line.split('='); return { left: left.trim(), right: right.join('=').trim() } }) })}/></label>}
          <label className="admin-editor-label">Search keywords, comma separated<input value={(question.keywords || []).join(', ')} onChange={(event) => updateQuestion(sectionIndex, questionIndex, { keywords: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })}/></label>
        </article>)}
        <button className="admin-add-button" onClick={() => updateSection(sectionIndex, { questions: [...section.questions, blankQuestion(Math.max(0, ...section.questions.map((question) => Number(question.number) || 0)) + 1)] })}><Plus size={15}/> Add question</button>
      </section>)}
      <button className="admin-add-button" onClick={() => setExam((current) => ({ ...current, sections: [...current.sections, { id: id('section'), title: `Section ${current.sections.length + 1}`, order: current.sections.length + 1, marks: 0, questions: [blankQuestion()] }] }))}><Plus size={15}/> Add section</button></div>
      <footer className="admin-editor-footer"><div className="admin-editor-state">{exam.id ? `Record: ${exam.id}` : 'New examination'} · Section and total marks recalculate from question marks.</div><div><button className="admin-secondary" onClick={() => setPreviewOpen(true)}><Eye size={16}/> Preview</button><button className="admin-secondary" disabled={busy} onClick={() => save(false)}><Save size={16}/> Save draft</button><button className="admin-primary" disabled={busy} onClick={() => save(true)}><Upload size={16}/> Publish</button></div></footer>
    </section>
    {previewOpen && <ExamPreview exam={{ ...exam, totalMarks }} sections={orderedSections} onClose={() => setPreviewOpen(false)}/>}
  </div>
}

function normalizeSections(sections = []) {
  return sections.map((section, sectionIndex) => ({ ...section, id: section.id || id('section'), order: Number(section.order) || sectionIndex + 1, questions: (section.questions || []).map((question, questionIndex) => ({ ...question, id: question.id || id('q'), number: Number(question.number) || questionIndex + 1, order: Number(question.order) || questionIndex + 1 })) }))
}

function SymbolBar({ editorKey, onInsert }) {
  return <div className="admin-symbol-bar" aria-label="Math and special characters">{symbols.map((symbol) => <button type="button" key={symbol} title={`Insert ${symbol}`} onMouseDown={(event) => event.preventDefault()} onClick={() => onInsert(editorKey, symbol)}>{symbol}</button>)}</div>
}

function ExamPreview({ exam, sections, onClose }) {
  return <div className="admin-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="admin-preview-modal" role="dialog" aria-modal="true" aria-labelledby="exam-preview-title"><header><div><span className="admin-kicker">PUBLISH PREVIEW</span><h2 id="exam-preview-title">{exam.title || 'Untitled examination'}</h2><p>{exam.classId} · {exam.year} · {exam.subjectName}</p></div><button className="admin-icon-button" onClick={onClose} aria-label="Close preview"><X size={19}/></button></header><div className="admin-preview-summary"><span>{sections.length} sections</span><span>{sections.reduce((count, section) => count + section.questions.length, 0)} questions</span><strong>{exam.totalMarks} total marks</strong></div><div className="admin-preview-content">{sections.map((section, index) => <section key={section.id}><h3>{section.title || `Section ${index + 1}`} <small>({section.marks} marks)</small></h3>{section.questions.map((question) => <article key={question.id}><div className="admin-preview-question-heading"><strong>Question {question.number}</strong><span>({question.marks} Marks)</span></div><div className="rich-content" dangerouslySetInnerHTML={{ __html: safeHtml(question.question) }}/><strong>Answer:</strong><div className="rich-content" dangerouslySetInnerHTML={{ __html: safeHtml(question.answer) }}/></article>)}</section>)}</div><footer><button className="admin-secondary" onClick={onClose}>Continue editing</button></footer></section></div>
}
