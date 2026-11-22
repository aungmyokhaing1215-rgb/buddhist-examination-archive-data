import { ArrowUpRight, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
export default function ClassCard({ item, index }) { return <Link to={`/browse/${item.slug}`} className="class-card"><div className="class-card-top"><span className={`class-icon tone-${index}`}><BookOpen size={20}/></span><ArrowUpRight className="card-arrow" size={17}/></div><h3>{item.name}</h3><p>{item.subjects?.length || 0} ဘာသာရပ်</p><div className="class-rule"/></Link> }
