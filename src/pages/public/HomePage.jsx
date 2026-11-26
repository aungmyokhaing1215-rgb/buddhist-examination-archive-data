import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookMarked, CalendarDays, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import ClassCard from '../../components/ClassCard.jsx';
import { getCatalog, getSearchIndex } from '../../services/api.js';

const years = Array.from({ length: 27 }, (_, index) => 2000 + index);
const fallbackClasses = [
    ['မူလတန်း', 'primary'],
    ['ပထမယ်တန်း', 'first-level'],
    ['ပထမလတ်တန်း', 'first-middle'],
    ['ပထမကြီးတန်း', 'first-high'],
    ['ဓမ္မစရိယတန်း', 'dhammacariya'],
].map(([name, slug], index) => ({ id: slug, name, slug, order: index + 1, subjects: [] }));

export default function HomePage() {
    const navigate = useNavigate();
    const [catalog, setCatalog] = useState({ classes: fallbackClasses, years });
    const [index, setIndex] = useState([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([getCatalog(), getSearchIndex()])
            .then(([nextCatalog, nextIndex]) => {
                setCatalog(nextCatalog);
                setIndex(nextIndex);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const recentExams = useMemo(
        () =>
            [...index]
                .sort((a, b) => {
                    const dateDifference =
                        new Date(b.publishedAt || 0).getTime() -
                        new Date(a.publishedAt || 0).getTime();
                    return dateDifference || Number(b.year) - Number(a.year);
                })
                .slice(0, 6),
        [index]
    );

    function search(event) {
        event.preventDefault();
        const value = query.trim();
        navigate(value ? `/search?query=${encodeURIComponent(value)}` : '/search');
    }

    const availableYears = [...new Set(index.map((exam) => exam.year))].sort((a, b) => b - a);

    return (
        <>
            <section className="hero">
                <div className="hero-inner">
                    <div className="hero-copy">
                        <div className="eyebrow">
                            <span /> စာပေကို ထိန်းသိမ်း၊ ပညာကို မျှဝေ
                        </div>
                        <h1>
                            <em>စာမေးပွဲ မော်ကွန်းတိုက်</em>
                        </h1>
                        <p>
                            နှစ်ပေါင်းများစွာ စုစည်းထားသော စာမေးပွဲ မေးခွန်းနှင့် အဖြေများကို
                            တစ်နေရာတည်းတွင် လေ့လာရှာဖွေပါ။
                        </p>
                        <form className="home-search" onSubmit={search}>
                            <Search size={18} />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                aria-label="မေးခွန်းနှင့် အဖြေ ရှာဖွေရန်"
                                placeholder="မေးခွန်း၊ အဖြေ၊ အဓိကစကားလုံး ရှာရန်"
                            />
                            <button className="button button-dark">ရှာဖွေရန်</button>
                        </form>
                        <div className="hero-actions">
                            <Link className="button button-outline" to="/browse">
                                အတန်းရွေးချယ်ရန် <ArrowRight size={16} />
                            </Link>
                            <span className="hero-note">
                                <BookMarked size={15} /> မေးခွန်းနှင့် အဖြေများ
                            </span>
                        </div>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                        <div className="art-ring ring-one" />
                        <div className="art-ring ring-two" />
                        <div className="art-sun" />
                        <div className="art-leaf leaf-one" />
                        <div className="art-leaf leaf-two" />
                        <div className="art-book">
                            <div />
                            <div />
                            <span>ဓမ္မ</span>
                        </div>
                        <div className="art-caption">
                            ပရိယတ္တိ · ပဋိပတ္တိ Kg, G1, G2, G3, G4, G5, G6, G7, G8, G9, G10, G11,
                            G12
                        </div>
                        <div className="hero-bottom">
                            <span>အစဉ်အလာကို ထိန်းသိမ်းခြင်း</span>
                            <span>တိကျမှု · လွယ်ကူမှု · လက်လှမ်းမီမှု</span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="content-section">
                <div className="section-heading">
                    <div>
                        <div className="eyebrow eyebrow-muted">သင်ယူမှု ခရီးစဉ်</div>
                        <h2>အတန်းအလိုက် ရွေးချယ်ပါ</h2>
                        <p>သင်လိုအပ်သော စာမေးပွဲအတန်းကို ရွေးချယ်ပြီး စတင်လေ့လာပါ။</p>
                    </div>
                    <Link to="/browse" className="text-link">
                        အားလုံး ကြည့်ရန် <ArrowRight size={15} />
                    </Link>
                </div>
                <div className="class-grid">
                    {catalog.classes.map((item, index) => (
                        <ClassCard key={item.id} item={item} index={index} />
                    ))}
                </div>
                <div className="archive-banner">
                    <div className="banner-icon">
                        <CalendarDays size={20} />
                    </div>
                    <div>
                        <strong>၂၀၀၀–၂၀၂၆ စာမေးပွဲနှစ်များ</strong>
                        <span>
                            {availableYears.length
                                ? `${availableYears.length} နှစ်အတွက် စာမေးပွဲ ထုတ်ဝေထားသည်`
                                : 'စာမေးပွဲနှစ်အလိုက် ရှာဖွေပါ'}
                        </span>
                    </div>
                    <Link to="/search" className="banner-years">
                        နှစ်ရွေးရန် <ArrowRight size={15} />
                    </Link>
                </div>
                <div className="year-chip-list" aria-label="စာမေးပွဲနှစ်များ">
                    {years.map((year) => (
                        <Link
                            className={availableYears.includes(year) ? 'has-exams' : ''}
                            key={year}
                            to={`/search?year=${year}`}
                        >
                            {year}
                        </Link>
                    ))}
                </div>
            </section>

            <section className="content-section home-section-muted">
                <div className="section-heading">
                    <div>
                        <div className="eyebrow eyebrow-muted">အတန်းအလိုက် ဘာသာရပ်</div>
                        <h2>ဘာသာရပ်အမျိုးအစားများ</h2>
                        <p>စီမံခန့်ခွဲသူ ထည့်သွင်းထားသော အတန်းအလိုက် ဘာသာရပ်များ။</p>
                    </div>
                </div>
                <div className="category-grid">
                    {catalog.classes.map((item, index) => (
                        <article className="category-card" key={item.id}>
                            <Link to={`/browse/${item.slug}`}>
                                <span className={`class-icon tone-${index}`}>
                                    {String(item.order).padStart(2, '0')}
                                </span>
                                <strong>{item.name}</strong>
                                <ArrowRight size={15} />
                            </Link>
                            {item.subjects?.length ? (
                                <div className="category-subjects">
                                    {item.subjects.map((subject) => (
                                        <Link
                                            key={subject.id}
                                            to={`/search?classSlug=${item.slug}&subjectId=${subject.id}`}
                                        >
                                            {subject.name}
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <p>ဘာသာရပ်များ ထည့်သွင်းပြီးနောက် ဤနေရာတွင် ဖော်ပြပါမည်။</p>
                            )}
                        </article>
                    ))}
                </div>
            </section>

            <section className="content-section">
                <div className="section-heading">
                    <div>
                        <div className="eyebrow eyebrow-muted">အသစ်ထုတ်ဝေထားသော</div>
                        <h2>လတ်တလော စာမေးပွဲများ</h2>
                        <p>ထုတ်ဝေထားသော စာမေးပွဲမေးခွန်းများနှင့် အဖြေများကို ဆက်လက်လေ့လာပါ။</p>
                    </div>
                    <Link to="/browse" className="text-link">
                        မော်ကွန်းအားလုံး <ArrowRight size={15} />
                    </Link>
                </div>
                {recentExams.length ? (
                    <div className="recent-exam-grid">
                        {recentExams.map((exam) => (
                            <Link
                                className="recent-exam-card"
                                key={exam.id}
                                to={`/exam/${exam.classId}/${exam.year}/${exam.subjectId}`}
                            >
                                <span className="recent-exam-meta">
                                    {exam.className} · {exam.year}
                                </span>
                                <strong>{exam.title}</strong>
                                <span>{exam.subjectName}</span>
                                <small>
                                    {exam.sections?.length || 0} အပိုင်း <ArrowRight size={14} />
                                </small>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state recent-empty">
                        <div className="empty-mark">◌</div>
                        <strong>
                            {loading ? 'မော်ကွန်းအချက်အလက်များ ရယူနေသည်…' : 'စာမေးပွဲ မရှိသေးပါ'}
                        </strong>
                        <p>ထုတ်ဝေထားသော စာမေးပွဲများ ထည့်သွင်းပြီးနောက် ဤနေရာတွင် ပေါ်လာပါမည်။</p>
                    </div>
                )}
            </section>
        </>
    );
}
