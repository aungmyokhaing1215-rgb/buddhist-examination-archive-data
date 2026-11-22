import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Search, X } from 'lucide-react'
import { getCatalog, getSearchIndex, searchArchive } from '../../services/api.js'

const PAGE_SIZE = 20
const normalize = (value) => String(value || '').normalize('NFC').toLocaleLowerCase()
const excerpt = (value, length = 280) => {
  const text = String(value || '').trim()
  return text.length > length ? `${text.slice(0, length).trim()}…` : text
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [catalog, setCatalog] = useState({ classes: [], years: [] })
  const [index, setIndex] = useState([])
  const [query, setQuery] = useState(searchParams.get('query') || '')
  const [classSlug, setClassSlug] = useState(searchParams.get('classSlug') || '')
  const [year, setYear] = useState(searchParams.get('year') || '')
  const [subjectId, setSubjectId] = useState(searchParams.get('subjectId') || '')
  const [result, setResult] = useState({ results: [], total: 0, page: 1, pageSize: PAGE_SIZE })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const paramsKey = searchParams.toString()

  useEffect(() => {
    Promise.all([getCatalog(), getSearchIndex()])
      .then(([nextCatalog, nextIndex]) => {
        setCatalog(nextCatalog)
        setIndex(nextIndex)
      })
      .catch(() => setError('မော်ကွန်းအချက်အလက်များကို ရယူ၍မရပါ။'))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(paramsKey)
    const values = {
      query: params.get('query') || '',
      classSlug: params.get('classSlug') || '',
      year: params.get('year') || '',
      subjectId: params.get('subjectId') || '',
      page: Number(params.get('page')) || 1,
      pageSize: PAGE_SIZE,
    }
    setQuery(values.query)
    setClassSlug(values.classSlug)
    setYear(values.year)
    setSubjectId(values.subjectId)
    setError('')

    if (values.query.trim().length < 2 && !values.classSlug && !values.year && !values.subjectId) {
      setResult({ results: [], total: 0, page: 1, pageSize: PAGE_SIZE })
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    searchArchive(values)
      .then((nextResult) => active && setResult(nextResult))
      .catch(() => active && setError('ရှာဖွေမှု မအောင်မြင်ပါ။ ထပ်မံကြိုးစားပါ။'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [paramsKey])

  const selectedClass = catalog.classes.find((item) => item.slug === classSlug)
  const subjectOptions = useMemo(() => catalog.classes.flatMap((item) => {
    if (selectedClass && item.id !== selectedClass.id) return []
    const available = new Set(index
      .filter((exam) => exam.classId === item.id && (!year || String(exam.year) === year))
      .map((exam) => exam.subjectId))
    return item.subjects
      .filter((subject) => available.has(subject.id))
      .map((subject) => ({ ...subject, className: item.name }))
  }), [catalog.classes, index, selectedClass, year])
  const yearOptions = useMemo(() => [...new Set(index
    .filter((item) => (!selectedClass || item.classId === selectedClass.id)
      && (!subjectId || item.subjectId === subjectId))
    .map((item) => item.year))].sort((a, b) => b - a), [index, selectedClass, subjectId])
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))

  function submit(event) {
    event.preventDefault()
    const next = new URLSearchParams()
    if (query.trim()) next.set('query', query.trim())
    if (classSlug) next.set('classSlug', classSlug)
    if (year) next.set('year', year)
    if (subjectId) next.set('subjectId', subjectId)
    setSearchParams(next)
  }

  function clear() {
    setQuery('')
    setClassSlug('')
    setYear('')
    setSubjectId('')
    setSearchParams({})
  }

  function changePage(nextPage) {
    const next = new URLSearchParams(searchParams)
    if (nextPage <= 1) next.delete('page')
    else next.set('page', String(nextPage))
    setSearchParams(next)
  }

  const hasCriteria = Boolean(query.trim() || classSlug || year || subjectId)

  return <section className="browse-wrap search-page">
    <div className="breadcrumbs"><Link to="/">ပင်မစာမျက်နှာ</Link><span>/</span><span>ရှာဖွေရန်</span></div>
    <div className="browse-heading"><div><div className="eyebrow eyebrow-muted">မော်ကွန်းတစ်ခုလုံးကို ရှာဖွေပါ</div><h1>မေးခွန်းနှင့် အဖြေ ရှာဖွေရန်</h1><p>စာသား၊ အဖြေ၊ အတန်း၊ နှစ်နှင့် ဘာသာရပ်တို့ကို ပေါင်းစပ်စစ်ထုတ်နိုင်သည်။</p></div></div>

    <form className="archive-search-form" onSubmit={submit}>
      <label className="search-query-field"><span>ရှာဖွေလိုသော စကားလုံး</span><div><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="မေးခွန်း၊ အဖြေ သို့မဟုတ် အဓိကစကားလုံး"/></div></label>
      <label><span>အတန်း</span><select value={classSlug} onChange={(event) => { setClassSlug(event.target.value); setSubjectId('') }}><option value="">အတန်းအားလုံး</option>{catalog.classes.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
      <label><span>နှစ်</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="">နှစ်အားလုံး</option>{yearOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label><span>ဘာသာရပ်</span><select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">ဘာသာရပ်အားလုံး</option>{subjectOptions.map((item) => <option key={item.id} value={item.id}>{classSlug ? item.name : `${item.className} · ${item.name}`}</option>)}</select></label>
      <div className="search-form-actions"><button className="button button-dark" type="submit"><Search size={16}/> ရှာဖွေရန်</button><button className="button button-outline" type="button" onClick={clear}><X size={15}/> စစ်ထုတ်မှုဖျက်ရန်</button></div>
    </form>

    <div className="search-results-heading"><div><h2>ရှာဖွေမှုရလဒ်များ</h2><p>{loading ? 'ရှာဖွေနေသည်…' : `${result.total.toLocaleString()} ခု တွေ့ရှိသည်`}</p></div>{hasCriteria && <button className="text-button" type="button" onClick={clear}>ရှာဖွေမှုအသစ် စတင်ရန်</button>}</div>
    {error ? <div className="empty-state"><strong>{error}</strong></div>
      : loading ? <div className="empty-state search-loading" role="status"><span className="loading-spinner"/><strong>ရှာဖွေနေသည်…</strong><p>ထုတ်ဝေထားသော စာမေးပွဲများကို စစ်ဆေးနေသည်။</p></div>
      : !hasCriteria ? <div className="empty-state"><div className="empty-mark">⌕</div><strong>ရှာဖွေမှု စတင်ပါ</strong><p>စကားလုံးရိုက်ထည့်ပါ၊ သို့မဟုတ် အတန်း၊ နှစ်၊ ဘာသာရပ်ကို ရွေးချယ်ပါ။</p></div>
      : result.results.length ? <>
        <div className="search-results-list">{result.results.map((item) => <article className="search-result-card" key={`${item.id}-${item.classSlug}-${item.year}`}>
          <div className="search-result-meta"><span>{item.className}</span><i/> <span>{item.year}</span><i/> <span>{item.subjectName}</span></div>
          <h3><Link to={`/exam/${item.classSlug}/${item.year}/${item.subjectId}#question-${encodeURIComponent(item.id)}`}>{item.title} · မေးခွန်း {item.questionNumber}<ArrowRight size={15}/></Link></h3>
          {item.questionText && <div className="result-content"><strong>မေးခွန်း</strong><p>{excerpt(item.questionText)}</p></div>}
          {item.answerText && <div className="result-content result-answer"><strong>အဖြေ</strong><p>{excerpt(item.answerText)}</p></div>}
          <Link className="result-open-link" to={`/exam/${item.classSlug}/${item.year}/${item.subjectId}#question-${encodeURIComponent(item.id)}`}>စာမေးပွဲသို့ သွားရန် <ArrowRight size={14}/></Link>
        </article>)}</div>
        <nav className="pagination" aria-label="ရှာဖွေမှု စာမျက်နှာများ"><span>{result.total ? `${(result.page - 1) * PAGE_SIZE + 1}–${Math.min(result.page * PAGE_SIZE, result.total)} / ${result.total}` : ''}</span><div><button type="button" onClick={() => changePage(result.page - 1)} disabled={result.page <= 1}>ယခင်</button><span>စာမျက်နှာ {result.page} / {pageCount}</span><button type="button" onClick={() => changePage(result.page + 1)} disabled={result.page >= pageCount}>နောက်</button></div></nav>
      </> : <div className="empty-state"><div className="empty-mark">⌕</div><strong>ရလဒ် မတွေ့ရှိပါ</strong><p>အခြားစကားလုံး သို့မဟုတ် စစ်ထုတ်မှုများဖြင့် ထပ်ရှာကြည့်ပါ။</p></div>}
  </section>
}
