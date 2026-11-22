import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ClassCard from '../../components/ClassCard.jsx'
import { getCatalog, getSearchIndex } from '../../services/api.js'

export default function BrowsePage() {
  const { classSlug, year, subjectId } = useParams()
  const [catalog, setCatalog] = useState({ classes: [], years: [] })
  const [index, setIndex] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getCatalog(), getSearchIndex()])
      .then(([nextCatalog, nextIndex]) => {
        setCatalog(nextCatalog)
        setIndex(nextIndex)
      })
      .catch(() => setError('မော်ကွန်းအချက်အလက်များကို ရယူ၍မရပါ။'))
      .finally(() => setLoading(false))
  }, [])

  const selectedClass = catalog.classes.find((item) => item.slug === classSlug)
  const classExams = useMemo(() => index.filter((item) => item.classId === selectedClass?.id), [index, selectedClass])
  const availableYears = useMemo(() => [...new Set(classExams.map((item) => item.year))].sort((a, b) => a - b), [classExams])
  const yearExams = useMemo(() => classExams.filter((item) => String(item.year) === String(year)), [classExams, year])
  const availableSubjects = useMemo(() => {
    const ids = new Set(yearExams.map((item) => item.subjectId))
    return (selectedClass?.subjects || []).filter((item) => ids.has(item.id))
  }, [selectedClass, yearExams])
  const selectedExams = yearExams.filter((item) => item.subjectId === subjectId)

  return <section className="browse-wrap">
    <div className="breadcrumbs"><Link to="/">ပင်မစာမျက်နှာ</Link><span>/</span><span>မော်ကွန်းတိုက်</span>{selectedClass && <><span>/</span><Link to={`/browse/${selectedClass.slug}`}>{selectedClass.name}</Link></>}{year && <><span>/</span><Link to={`/browse/${classSlug}/${year}`}>{year}</Link></>}{subjectId && <><span>/</span><span>{availableSubjects.find((item) => item.id === subjectId)?.name || subjectId}</span></>}</div>

    <div className="browse-heading"><div><div className="eyebrow eyebrow-muted">အတန်း၊ နှစ်၊ ဘာသာရပ်အလိုက်</div><h1>{selectedClass?.name || 'စာမေးပွဲ မော်ကွန်းတိုက်'}</h1><p>{year ? `${year} ခုနှစ်အတွက်` : 'ထုတ်ဝေထားသော စာမေးပွဲများကို'} ရွေးချယ်ကြည့်ရှုပါ။</p></div>{selectedClass && <div className="result-count"><strong>{classExams.length.toLocaleString()}</strong><span>စာမေးပွဲ</span></div>}</div>

    {error ? <div className="empty-state"><strong>{error}</strong></div>
      : loading ? <div className="empty-state search-loading" role="status"><span className="loading-spinner"/><strong>မော်ကွန်းအချက်အလက်များ ရယူနေသည်…</strong></div>
      : !classSlug ? <>
        <div className="section-heading browse-intro"><div><div className="eyebrow eyebrow-muted">အတန်းရွေးချယ်ရန်</div><h2>လေ့လာလိုသော အတန်းကို ရွေးပါ</h2><p>ထုတ်ဝေထားသော စာမေးပွဲအရေအတွက်ကို အတန်းတစ်ခုစီတွից စစ်ဆေးနိုင်သည်။</p></div></div>
        <div className="class-grid browse-class-grid">{catalog.classes.map((item, i) => <div className="browse-class-card" key={item.id}><ClassCard item={item} index={i}/><small>{index.filter((exam) => exam.classId === item.id).length} စာမေးပွဲ ထုတ်ဝေထားသည်</small></div>)}</div>
      </>
      : !selectedClass ? <div className="empty-state"><strong>အတန်းကို ရှာမတွေ့ပါ</strong><p>ရွေးချယ်ထားသော လမ်းကြောင်းကို စစ်ဆေးပါ။</p><Link className="button button-dark" to="/browse">အတန်းများသို့ ပြန်သွားရန်</Link></div>
      : !year ? <>
        <div className="section-heading browse-intro"><div><div className="eyebrow eyebrow-muted">နှစ်ရွေးချယ်ရန်</div><h2>{selectedClass.name} · ရနိုင်သော စာမေးပွဲနှစ်များ</h2><p>မော်ကွန်းတွင် စာမေးပွဲရှိသည့်နှစ်များကိုသာ ပြထားသည်။</p></div></div>
        {availableYears.length ? <div className="year-card-grid">{availableYears.map((item) => <Link className="year-card" key={item} to={`/browse/${classSlug}/${item}`}><CalendarDays size={19}/><strong>{item}</strong><span>{classExams.filter((exam) => exam.year === item).length} စာမေးပွဲ</span><ArrowRight size={16}/></Link>)}</div> : <EmptyArchive text="ဤအတန်းအတွက် ထုတ်ဝေထားသော စာမေးပွဲ မရှိသေးပါ။"/>}
      </>
      : !subjectId ? <>
        <div className="section-heading browse-intro"><div><div className="eyebrow eyebrow-muted">ဘာသာရပ်ရွေးချယ်ရန်</div><h2>{year} · ရရှိနိုင်သော ဘာသာရပ်များ</h2><p>ဤအတန်းနှင့်နှစ်အတွက် စာမေးပွဲရှိသော ဘာသာရပ်များကိုသာ ပြထားသည်။</p></div></div>
        {availableSubjects.length ? <div className="subject-card-grid">{availableSubjects.map((item) => <Link className="subject-card" key={item.id} to={`/browse/${classSlug}/${year}/${item.id}`}><span className="subject-card-mark">{String(item.order).padStart(2, '0')}</span><strong>{item.name}</strong><small>{year} စာမေးပွဲ</small><ArrowRight size={16}/></Link>)}</div> : <EmptyArchive text="ဤနှစ်အတွက် ထုတ်ဝေထားသော ဘာသာရပ် မရှိသေးပါ။"/>}
      </>
      : selectedExams.length ? <div className="exam-listing"><div className="section-heading browse-intro"><div><div className="eyebrow eyebrow-muted">ထုတ်ဝေထားသော စာမေးပွဲ</div><h2>{availableSubjects.find((item) => item.id === subjectId)?.name || selectedExams[0].subjectName}</h2><p>{selectedClass.name} · {year}</p></div></div>{selectedExams.map((exam) => <Link className="published-exam-row" key={exam.id} to={`/exam/${exam.classId}/${exam.year}/${exam.subjectId}`}><span className="published-exam-icon"><CalendarDays size={18}/></span><span><strong>{exam.title}</strong><small>{exam.subjectName} · {exam.year} · {exam.sections?.length || 0} အပိုင်း</small></span><ArrowRight size={17}/></Link>)}</div>
      : <EmptyArchive text="ဤရွေးချယ်မှုအတွက် စာမေးပွဲ မတွေ့ရှိပါ။"/>}
  </section>
}

function EmptyArchive({ text }) {
  return <div className="empty-state"><div className="empty-mark">◌</div><strong>စာမေးပွဲ မရှိသေးပါ</strong><p>{text}</p><Link className="text-link" to="/browse">အတန်းများကို ကြည့်ရန် <ArrowRight size={15}/></Link></div>
}
