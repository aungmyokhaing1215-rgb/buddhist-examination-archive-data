import { useEffect, useState } from 'react'
import { BookOpen, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getCatalog, getPublicLessons } from '../../services/api.js'

export default function LessonsPage() {
  const [catalog, setCatalog] = useState({ classes: [] })
  const [lessons, setLessons] = useState([])
  const [classSlug, setClassSlug] = useState('')
  const [subjectSlug, setSubjectSlug] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { getCatalog().then(setCatalog).catch(() => setError('အတန်းအချက်အလက်များကို ဖတ်မရပါ။')) }, [])
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    getPublicLessons({ ...(classSlug ? { classSlug } : {}), ...(subjectSlug ? { subjectSlug } : {}) })
      .then((data) => active && setLessons(data.lessons || []))
      .catch((failure) => active && setError(failure.response?.data?.error || 'သင်ခန်းစာများကို ဖတ်မရပါ။'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [classSlug, subjectSlug])
  const selectedClass = catalog.classes.find((item) => item.slug === classSlug)
  const subjects = selectedClass?.subjects || []
  return <section className="browse-wrap lessons-page">
    <div className="breadcrumbs"><Link to="/">ပင်မစာမျက်နှာ</Link><span>/</span><span>သင်ခန်းစာများ</span></div>
    <header className="browse-heading"><div><span className="eyebrow eyebrow-muted">လေ့လာရန်</span><h1>သင်ခန်းစာများ</h1><p>အတန်းနှင့် ဘာသာရပ်အလိုက် စုစည်းထားသော သင်ခန်းစာများ။</p></div><strong className="lesson-result-count">{lessons.length} သင်ခန်းစာ</strong></header>
    <div className="lesson-filter-bar"><label>အတန်း<select value={classSlug} onChange={(event) => { setClassSlug(event.target.value); setSubjectSlug('') }}><option value="">အတန်းအားလုံး</option>{catalog.classes.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label><label>ဘာသာရပ်<select value={subjectSlug} onChange={(event) => setSubjectSlug(event.target.value)} disabled={!classSlug}><option value="">ဘာသာရပ်အားလုံး</option>{subjects.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label><button className="button button-outline" onClick={() => { setClassSlug(''); setSubjectSlug('') }}>ရှင်းလင်းရန်</button></div>
    {loading ? <div className="empty-state" role="status"><strong>သင်ခန်းစာများကို ရယူနေသည်…</strong></div> : error ? <div className="empty-state"><strong>{error}</strong></div> : lessons.length ? <div className="lesson-list">{lessons.map((lesson) => <Link className="lesson-list-card" key={lesson.id} to={`/lesson/${lesson.classSlug}/${lesson.subjectSlug}/${lesson.slug}`}><span className="lesson-list-icon"><BookOpen size={19}/></span><span className="lesson-list-copy"><small>{lesson.className}　·　{lesson.subjectName}</small><strong>{lesson.title}</strong></span><ChevronRight size={18}/></Link>)}</div> : <div className="empty-state"><BookOpen className="empty-mark"/><strong>သင်ခန်းစာ မရှိသေးပါ</strong><p>ရွေးချယ်ထားသော အတန်းနှင့် ဘာသာရပ်အတွက် ထုတ်ဝေထားသည့် သင်ခန်းစာ မရှိသေးပါ။</p></div>}
  </section>
}
