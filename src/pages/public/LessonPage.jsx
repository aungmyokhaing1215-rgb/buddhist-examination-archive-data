import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { BookOpen } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { getPublicLesson } from '../../services/api.js'

export default function LessonPage() {
  const params = useParams()
  const [lesson, setLesson] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setLesson(null); setError('')
    getPublicLesson(params).then((data) => active && setLesson(data)).catch((failure) => active && setError(failure.response?.status === 404 ? 'ဤသင်ခန်းစာကို ရှာမတွေ့ပါ။' : failure.response?.data?.error || 'သင်ခန်းစာကို ရယူမရပါ။'))
    return () => { active = false }
  }, [params.classSlug, params.subjectSlug, params.lessonSlug])
  if (error) return <section className="browse-wrap"><div className="empty-state"><BookOpen className="empty-mark"/><strong>{error}</strong><Link className="button button-dark" to="/lessons">သင်ခန်းစာများသို့ ပြန်ရန်</Link></div></section>
  if (!lesson) return <section className="browse-wrap"><div className="empty-state" role="status"><strong>သင်ခန်းစာကို ရယူနေသည်…</strong></div></section>
  return <article className="browse-wrap lesson-page"><div className="breadcrumbs"><Link to="/">ပင်မစာမျက်နှာ</Link><span>/</span><Link to="/lessons">သင်ခန်းစာများ</Link><span>/</span><span>{lesson.title}</span></div><header className="lesson-page-heading"><span className="lesson-page-icon"><BookOpen size={19}/></span><div><div className="eyebrow eyebrow-muted">{lesson.className}　·　{lesson.subjectName}</div><h1>{lesson.title}</h1><p>သင်ခန်းစာ</p></div></header><div className="lesson-reading rich-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(lesson.content || '') }}/></article>
}
