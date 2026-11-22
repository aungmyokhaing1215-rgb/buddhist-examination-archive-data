import { useEffect, useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import { ArrowUp, Printer } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getCatalog, getExam } from '../../services/api.js'
import '../../schema.css'

const safeHtml = (html) => DOMPurify.sanitize(html || '')

export default function ExamPage() {
  const params = useParams()
  const location = useLocation()
  const [exam, setExam] = useState(null)
  const [className, setClassName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setExam(null)
    setError('')
    Promise.all([getExam(params), getCatalog()])
      .then(([nextExam, catalog]) => {
        if (!active) return
        setExam(nextExam)
        setClassName(catalog.classes.find((item) => item.id === nextExam.classId)?.name || '')
      })
      .catch(() => active && setError('ဤစာမေးပွဲကို ရှာမတွေ့ပါ။'))
    return () => { active = false }
  }, [params.classSlug, params.year, params.subjectId])

  useEffect(() => {
    if (!exam || !location.hash) return
    const targetId = decodeURIComponent(location.hash.slice(1))
    requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [exam, location.hash])

  const sections = useMemo(() => [...(exam?.sections || [])]
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map((section) => ({
      ...section,
      questions: [...(section.questions || [])].sort((a, b) => Number(a.number) - Number(b.number) || Number(a.order) - Number(b.order)),
    })), [exam])

  if (error) return <section className="browse-wrap"><div className="breadcrumbs"><Link to="/">ပင်မစာမျက်နှာ</Link><span>/</span><Link to="/browse">မော်ကွန်းတိုက်</Link></div><div className="empty-state"><div className="empty-mark">◌</div><strong>{error}</strong><p>ထုတ်ဝေပြီးသော စာမေးပွဲကို ရွေးချယ်ပါ။</p><Link className="button button-dark" to="/browse">မော်ကွန်းတိုက်သို့ ပြန်သွားရန်</Link></div></section>
  if (!exam) return <section className="browse-wrap"><div className="empty-state search-loading" role="status"><span className="loading-spinner"/><strong>စာမေးပွဲ အချက်အလက်များ ရယူနေသည်…</strong></div></section>

  return <article className="browse-wrap exam-page">
    <div className="breadcrumbs"><Link to="/">ပင်မစာမျက်နှာ</Link><span>/</span><Link to="/browse">မော်ကွန်းတိုက်</Link><span>/</span><Link to={`/browse/${params.classSlug}`}>{className || params.classSlug}</Link><span>/</span><span>{exam.year}</span></div>
    <header className="exam-page-header"><div><div className="eyebrow eyebrow-muted">{className || params.classSlug} · {exam.year} · {exam.subjectName}</div><h1 className="exam-title">{exam.title}</h1><div className="exam-meta"><span>{className || params.classSlug}</span><span>{exam.year}</span><span>{exam.subjectName}</span><span>{exam.totalMarks} မှတ်</span></div></div><button type="button" className="button button-outline print-button" onClick={() => window.print()}><Printer size={16}/> ပုံနှိပ်ရန်</button></header>

    <div className="exam-reading-layout">
      <nav className="exam-section-nav" aria-label="စာမေးပွဲအပိုင်းများ"><strong>အပိုင်းများ</strong>{sections.map((section, index) => <a key={section.id} href={`#section-${encodeURIComponent(section.id)}`}>{section.title || `အပိုင်း ${index + 1}`}<span>{section.marks} မှတ်</span></a>)}<a href="#top" className="to-top-link"><ArrowUp size={14}/> အပေါ်သို့</a></nav>
      <div className="exam-sections" id="top">{sections.map((section, sectionIndex) => <section className="exam-section" id={`section-${section.id}`} key={section.id}>
        <header className="exam-section-heading"><div><span>အပိုင်း {sectionIndex + 1}</span><h2>{section.title}</h2></div><strong>{section.marks} မှတ်</strong></header>
        {section.questions.map((question) => <article className="question-card exam-question-card" id={`question-${question.id}`} key={question.id}>
          <div className="question-heading"><h3>မေးခွန်း {question.number}.</h3><span>({question.marks} Marks)</span></div>
          <div className="question-html rich-content" dangerouslySetInnerHTML={{ __html: safeHtml(question.question) }}/>
          {Array.isArray(question.options) && question.options.length > 0 && <QuestionOptions options={question.options}/>}
          <div className="answer-block"><strong>အဖြေ</strong><div className="answer-content rich-content" dangerouslySetInnerHTML={{ __html: safeHtml(question.answer) }}/></div>
        </article>)}
      </section>)}</div>
    </div>
  </article>
}

function QuestionOptions({ options }) {
  if (typeof options[0] === 'object' && options[0] !== null) {
    const keys = [...new Set(options.flatMap((option) => Object.keys(option)))]
    return <div className="question-options-table-wrap"><table className="question-options-table"><tbody>{options.map((option, index) => <tr key={option.id || index}>{keys.map((key) => <td key={key}>{String(option[key] ?? '')}</td>)}</tr>)}</tbody></table></div>
  }
  return <ol className="question-options-list">{options.map((option, index) => <li key={index}>{String(option)}</li>)}</ol>
}
