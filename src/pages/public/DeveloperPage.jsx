import { ArrowUpRight, BookOpen, Mail, Phone, Send } from 'lucide-react'
import { Link } from 'react-router-dom'

const contacts = [
  { label: 'ဖုန်း', value: '09257031942', href: 'tel:09257031942', icon: Phone },
  { label: 'အီးမေးလ်', value: 'ashinindavudha2018@gmail.com', href: 'mailto:ashinindavudha2018@gmail.com', icon: Mail },
  { label: 'Telegram', value: '@amy2048', href: 'https://t.me/amy2048', icon: Send, external: true },
]

export default function DeveloperPage() {
  return <section className="browse-wrap developer-page">
    <div className="breadcrumbs"><Link to="/">ပင်မစာမျက်နှာ</Link><span>/</span><span>ဆက်သွယ်ရန်</span></div>
    <div className="developer-card">
      <div className="developer-copy">
        <span className="developer-kicker"><BookOpen size={15}/> Buddhist Examination Archive</span>
        <p className="eyebrow eyebrow-muted">တည်ဆောက်သူ</p>
        <h1>ဆက်သွယ်ရန်</h1>
        <p className="developer-intro">ပရိယတ္တိစာမေးပွဲ မော်ကွန်းနှင့်ပတ်သက်၍ မေးမြန်းရန်၊ အကြံပြုရန် သို့မဟုတ် အမှားပြင်ဆင်ချက် ပေးပို့ရန် အောက်ပါနည်းလမ်းများမှတစ်ဆင့် ဆက်သွယ်နိုင်ပါသည်။</p>
        <blockquote className="developer-verse">
          <p>သူကောင်းတစ်ယောက် ကြီးမှူးမြှောက်က ထွန်းတောက်ပြည်ရွာ စည်ပင်သာ၏။<br/>သူယုတ်တစ်ယောက် ကြီးမှူးရောက်က မျက်မှောက်ပျက်စီး ဒုက္ခမီးတည်း။</p>
          <cite>လောကသာရပျို့</cite>
        </blockquote>
        <div className="developer-contacts" aria-label="ဆက်သွယ်ရန် နည်းလမ်းများ">
          {contacts.map(({ label, value, href, icon: Icon, external }) => <a className="developer-contact" href={href} key={label} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
            <span className="developer-contact-icon"><Icon size={19}/></span>
            <span className="developer-contact-copy"><small>{label}</small><strong>{value}</strong></span>
            <ArrowUpRight className="developer-contact-arrow" size={17}/>
          </a>)}
        </div>
      </div>
      <figure className="developer-portrait-frame">
        <div className="developer-portrait-glow" aria-hidden="true" />
        <img src="/images/developer-portrait.jpg" alt="မော်ကွန်းတည်ဆောက်သူ၏ ဓာတ်ပုံ" />
        <figcaption><span>ပရိယတ္တိ မော်ကွန်း</span><span>စာမေးပွဲများကို စုစည်းထိန်းသိမ်းခြင်း</span></figcaption>
      </figure>
    </div>
  </section>
}
