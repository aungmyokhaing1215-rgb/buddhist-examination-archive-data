import { BookOpen, Database, Search, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AboutPage() {
  return <section className="browse-wrap about-page">
    <div className="breadcrumbs"><Link to="/">ပင်မစာမျက်နှာ</Link><span>/</span><span>အကြောင်း</span></div>
    <div className="about-hero"><div className="eyebrow eyebrow-muted">Buddhist Examination Archive</div><h1>ပရိယတ္တိစာမေးပွဲ မော်ကွန်း</h1><p>စာမေးပွဲမေးခွန်းနှင့် အဖြေများကို နှစ်၊ အတန်း၊ ဘာသာရပ်အလိုက် စုစည်းရှာဖွေလေ့လာနိုင်ရန် တည်ဆောက်ထားသော ဒစ်ဂျစ်တယ်မော်ကွန်းတိုက်။</p></div>
    <div className="about-feature-grid"><article><span><BookOpen size={19}/></span><h2>အတန်းအလိုက် စုစည်းမှု</h2><p>မူလတန်းမှ ဓမ္မစရိယတန်းအထိ အတန်း၊ စာမေးပွဲနှစ်နှင့် ဘာသာရပ်တို့အလိုက် လွယ်ကူစွာ ရွေးချယ်နိုင်သည်။</p></article><article><span><Search size={19}/></span><h2>မေးခွန်းနှင့် အဖြေရှာဖွေမှု</h2><p>ထုတ်ဝေထားသော မေးခွန်း၊ အဖြေနှင့် အဓိကစကားလုံးများကို မော်ကွန်းတစ်ခုလုံးတွင် ရှာဖွေနိုင်သည်။</p></article><article><span><Database size={19}/></span><h2>အချက်အလက် ထိန်းသိမ်းမှု</h2><p>စာမေးပွဲအချက်အလက်များကို JSON ဖိုင်များဖြင့် သိမ်းဆည်းစီမံပြီး ရှာဖွေရေးအညွှန်းကို ထုတ်ဝေသည့်အခါ ပြန်လည်တည်ဆောက်သည်။</p></article><article><span><ShieldCheck size={19}/></span><h2>ထုတ်ဝေထားသော အကြောင်းအရာ</h2><p>စီမံခန့်ခွဲသူ အတည်ပြုထုတ်ဝေထားသော စာမေးပွဲများကိုသာ အများပြည်သူ စာမျက်နှာတွင် ဖော်ပြသည်။</p></article></div>
    <div className="about-cta"><div><strong>လေ့လာမှုကို စတင်ပါ</strong><span>အတန်းတစ်ခု ရွေးချယ်ပါ၊ သို့မဟုတ် မေးခွန်းတစ်ခုကို ရှာဖွေပါ။</span></div><div><Link className="button button-dark" to="/browse">မော်ကွန်းကြည့်ရန်</Link><Link className="button button-outline" to="/search">ရှာဖွေရန်</Link></div></div>
  </section>
}
