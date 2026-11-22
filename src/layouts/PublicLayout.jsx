import { BookOpen, Search, ShieldCheck } from 'lucide-react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'

export default function PublicLayout() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  function submit(event) { event.preventDefault(); if (query.trim()) navigate(`/browse?query=${encodeURIComponent(query.trim())}`) }
  return <div className="min-h-screen"><header className="site-header"><div className="header-inner"><Link className="brand" to="/"><span className="brand-mark"><BookOpen size={21}/></span><span><strong>ပရိယတ္တိ</strong><small>စာမေးပွဲ မော်ကွန်းတိုက်</small></span></Link><form className="search-box" onSubmit={submit}><Search size={17}/><input aria-label="Search archive" value={query} onChange={e=>setQuery(e.target.value)} placeholder="မေးခွန်း၊ ဘာသာရပ် ရှာဖွေရန်"/><kbd>↵</kbd></form><Link className="admin-link" to="/admin"><ShieldCheck size={17}/><span>စီမံခန့်ခွဲရန်</span></Link></div></header><main><Outlet /></main><footer className="site-footer"><span>ဗုဒ္ဓဘာသာ စာမေးပွဲမေးခွန်းများ စုစည်းရာ</span><span>၂၀၀၀ — ၂၀၂၆</span></footer></div>
}
