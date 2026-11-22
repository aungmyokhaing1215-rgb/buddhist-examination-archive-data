import { ArrowLeft, Search } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return <section className="not-found-page"><span className="not-found-code">404</span><div className="eyebrow eyebrow-muted">စာမျက်နှာ မတွေ့ရှိပါ</div><h1>ဤလမ်းကြောင်းကို ရှာမတွေ့ပါ</h1><p>လိပ်စာကို စစ်ဆေးပါ၊ သို့မဟုတ် မော်ကွန်းတစ်ခုလုံးတွင် ရှာဖွေပါ။</p><div><Link className="button button-dark" to="/"><ArrowLeft size={15}/> ပင်မစာမျက်နှာ</Link><Link className="button button-outline" to="/search"><Search size={15}/> ရှာဖွေရန်</Link></div></section>
}
