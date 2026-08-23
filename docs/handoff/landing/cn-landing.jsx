/* Spymaster Mission — landing page. Uses window globals from cn-components.jsx + cn-lobby.jsx */
const LT = THEMES.sand;

const STR = {
  ar: {
    tag: 'لعبة كلمات وجواسيس للعائلة',
    h1: <>تلميح واحد. <span style={{ color: 'var(--cn-red-ink)' }}>٢٥ كلمة.</span> فريقان.</>,
    sub: 'اجمع العائلة: سيّد التجسس يعطي تلميحًا من كلمة واحدة، وفريقك يكشف البطاقات الصحيحة — واحذروا القاتل.',
    play: 'ابدأ غرفة الآن', how: 'كيف تُلعب؟', tryMe: 'جرّبها — المس البطاقات', reset: 'أعد البطاقات',
    howTitle: 'كيف تُلعب', steps: [
      { t: 'أنشئ غرفة وشارك الرمز', b: 'رابط واحد يجمع الجميع — كل لاعب يدخل من متصفح هاتفه.' },
      { t: 'السيّد يلمّح بكلمة واحدة', b: 'سيّدا التجسس وحدهما يريان المفتاح، وكل منهما يعطي تلميحًا: كلمة ورقم.' },
      { t: 'الفريق يكشف البطاقات', b: 'خمّنوا كلمات فريقكم وتجنّبوا المارّة… ولا تلمسوا القاتل أبدًا.' },
    ],
    featTitle: 'صُنعت للعب العائلي', feats: [
      { k: 'noapp', t: 'بدون تطبيق', b: 'تعمل في المتصفح على أي هاتف.' },
      { k: 'free', t: 'مجانية', b: 'بدون حسابات وبدون إعلانات.' },
      { k: 'bi', t: 'عربي وإنجليزي', b: 'لوحة الكلمات والواجهة باللغتين.' },
      { k: 'cb', t: 'تُقرأ بدون ألوان', b: 'لكل فريق شكل مميز — واضحة لعمى الألوان وتحت الشمس.' },
    ],
    screensTitle: 'من داخل اللعبة', screens: ['الردهة — الفرق والأدوار', 'أثناء اللعب — شاشة اللاعب'],
    ctaTitle: 'جاهزون؟', ctaSub: 'غرفة جديدة في ثوانٍ — بدون تسجيل.', credit: 'لعبة عائلية صُنعت بحب',
    clue: 'التلميح', clueWord: 'ماء',
  },
  en: {
    tag: 'A word-spy party game for the family',
    h1: <>One clue. <span style={{ color: 'var(--cn-red-ink)' }}>25 words.</span> Two teams.</>,
    sub: 'Gather the family: the spymaster gives a one-word clue, your team reveals the right tiles — and everyone avoids the assassin.',
    play: 'Create a room', how: 'How to play', tryMe: 'Try it — tap the tiles', reset: 'Reset tiles',
    howTitle: 'How to play', steps: [
      { t: 'Create a room, share the code', b: 'One link brings everyone in — each player joins from their phone’s browser.' },
      { t: 'The spymaster gives one word', b: 'Only the spymasters see the key; each gives a clue: one word plus a number.' },
      { t: 'Your team flips the tiles', b: 'Guess your team’s words, dodge the bystanders… and never touch the assassin.' },
    ],
    featTitle: 'Made for family play', feats: [
      { k: 'noapp', t: 'No app', b: 'Runs in the browser on any phone.' },
      { k: 'free', t: 'Free', b: 'No accounts, no ads.' },
      { k: 'bi', t: 'Arabic & English', b: 'Board and interface ship in both languages.' },
      { k: 'cb', t: 'Reads without colour', b: 'Every team has its own glyph — clear for colour-blind players and in sunlight.' },
    ],
    screensTitle: 'Inside the game', screens: ['Lobby — teams & roles', 'In-game — operative view'],
    ctaTitle: 'Ready?', ctaSub: 'A fresh room in seconds — no sign-up.', credit: 'A family game, made with love',
    clue: 'CLUE', clueWord: 'WATER',
  },
};
const PLAY_URL = 'https://play.spymaster.elgemmy.com';

function Mark({ size = 34 }) {
  return (
    <div style={{ width: size, height: size, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: size * 0.11, flex: '0 0 auto' }}>
      {['red', 'blue', 'neutral', 'assassin'].map(r => <div key={r} style={{ background: `var(--cn-${r})`, borderRadius: size * 0.16 }} />)}
    </div>
  );
}

function LandChip({ role, n }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px 5px 9px', borderRadius: 999, background: `var(--cn-${role}-tint)`, color: `var(--cn-${role}-ink)` }}>
      <Glyph role={role} size={14} color={`var(--cn-${role})`} />
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
    </div>
  );
}

// ---- hero: playable 5x5 -------------------------------------------
function MiniBoard({ lang, t }) {
  const isAr = lang === 'ar';
  const data = isAr ? BOARD_AR : BOARD_EN;
  const [rev, setRev] = React.useState(() => new Set());
  const left = (role, total) => total - data.filter((c, i) => c.role === role && rev.has(i)).length;
  return (
    <div className="tilt" style={{ background: 'var(--cn-surface)', border: '1px solid var(--cn-line)', borderRadius: 22, padding: '14px 14px 12px', boxShadow: '0 24px 55px rgba(60,45,30,0.14)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 2px 10px' }}>
        <LandChip role="red" n={left('red', 9)} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cn-ink-soft)' }}>{t.tryMe}</span>
        <LandChip role="blue" n={left('blue', 8)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
        {data.map((c, i) => (
          <Card key={lang + i} word={c.word} role={c.role} state={rev.has(i) ? 'revealed' : 'idle'} lang={lang} dense onReveal={() => setRev(s => { const n = new Set(s); n.add(i); return n; })} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
        <button onClick={() => setRev(new Set())} style={{ all: 'unset', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--cn-ink-soft)', background: 'var(--cn-surface-2)', border: '1px solid var(--cn-line)', borderRadius: 999, padding: '6px 14px' }}>{t.reset}</button>
      </div>
    </div>
  );
}

// ---- hover-flip word row -------------------------------------------
const ROW = [
  { ar: 'وردة', en: 'ROSE', role: 'red' }, { ar: 'مفتاح', en: 'KEY', role: 'blue' }, { ar: 'قمر', en: 'MOON', role: 'neutral' },
  { ar: 'جسر', en: 'BRIDGE', role: 'red' }, { ar: 'ثعلب', en: 'FOX', role: 'assassin' }, { ar: 'بحر', en: 'OCEAN', role: 'blue' },
  { ar: 'نار', en: 'FIRE', role: 'red' }, { ar: 'ساعة', en: 'CLOCK', role: 'blue' },
];
const ROT = [-2, 1.5, -1, 2, -1.5, 1, -2, 1.5];

function HoverRow({ lang }) {
  const [on, setOn] = React.useState(() => new Set());
  const set = (i, v) => setOn(s => { const n = new Set(s); v ? n.add(i) : n.delete(i); return n; });
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', padding: '34px 24px 10px' }}>
      {ROW.map((w, i) => (
        <div key={lang + i} style={{ width: 106, transform: `rotate(${ROT[i]}deg)` }}
          onMouseEnter={() => set(i, true)} onMouseLeave={() => set(i, false)} onClick={() => set(i, !on.has(i))}>
          <Card word={w[lang]} role={w.role} state={on.has(i) ? 'revealed' : 'idle'} lang={lang} dense flip />
        </div>
      ))}
    </div>
  );
}

// ---- sections -------------------------------------------------------
function SectionHead({ t, isAr, title }) {
  return <h2 style={{ fontFamily: isAr ? "'Cairo', sans-serif" : "'Rubik', sans-serif", fontSize: 30, fontWeight: 700, margin: '0 0 26px', letterSpacing: isAr ? 0 : '-.01em', textAlign: 'center' }}>{title}</h2>;
}

function StepVisual({ n, lang, t }) {
  const isAr = lang === 'ar';
  if (n === 0) return <div style={{ display: 'grid', placeItems: 'center', height: 74 }}><span dir="ltr" style={{ fontFamily: "'DM Mono', monospace", fontSize: 25, fontWeight: 500, letterSpacing: '.06em', color: 'var(--cn-ink)', background: 'var(--cn-surface-2)', border: '1.5px dashed var(--cn-neutral)', borderRadius: 12, padding: '10px 18px' }}>QMR-72K</span></div>;
  if (n === 1) return (
    <div style={{ display: 'grid', placeItems: 'center', height: 74 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--cn-surface-2)', border: '1px solid var(--cn-line)', borderRadius: 'var(--cn-r-bar)', padding: '10px 16px' }}>
        <EyeMark size={18} color="var(--cn-ink)" />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cn-ink-soft)' }}>{t.clue}</span>
        <span style={{ fontSize: 19, fontWeight: 700 }}>{t.clueWord}</span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 500, color: 'var(--cn-red-ink)', background: 'var(--cn-red-tint)', borderRadius: 7, padding: '1px 8px' }}>3</span>
      </div>
    </div>
  );
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', height: 74 }}>
      {[{ w: isAr ? 'باب' : 'DOOR', r: 'neutral', s: 'idle' }, { w: isAr ? 'نار' : 'FIRE', r: 'red', s: 'revealed' }, { w: isAr ? 'سيف' : 'SWORD', r: 'assassin', s: 'revealed' }].map((c, i) => (
        <div key={i} style={{ width: 66 }}><Card word={c.w} role={c.r} state={c.s} lang={lang} dense flip={false} /></div>
      ))}
    </div>
  );
}

const FeatIcon = ({ k }) => {
  if (k === 'noapp') return <Glyph role="blue" size={20} color="var(--cn-blue)" />;
  if (k === 'free') return <Glyph role="neutral" size={20} color="var(--cn-neutral-ink)" />;
  if (k === 'bi') return <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1 }}><span style={{ fontFamily: "'Cairo', sans-serif" }}>ع</span><span style={{ fontFamily: "'Rubik', sans-serif", color: 'var(--cn-red-ink)' }}> · A</span></span>;
  return <span style={{ display: 'flex', gap: 5 }}>{['red', 'blue', 'neutral', 'assassin'].map(r => <Glyph key={r} role={r} size={13} color={`var(--cn-${r}-ink)`} />)}</span>;
};

// ---- phone frame ----------------------------------------------------
function StatusMini({ lang }) {
  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 20px 2px', background: 'var(--cn-bg)' }}>
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, color: 'var(--cn-ink)' }}>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 11, color: 'var(--cn-ink)' }}>●●●</span>
        <span style={{ width: 18, height: 9, borderRadius: 2, border: '1px solid var(--cn-ink)', position: 'relative', opacity: .85 }}><span style={{ position: 'absolute', inset: 1.5, background: 'var(--cn-ink)', borderRadius: 1, width: '70%' }} /></span>
      </div>
    </div>
  );
}

function PhoneFrame({ label, lang, h, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 412, maxWidth: '92vw', borderRadius: 44, padding: 11, background: '#28241f', boxShadow: '0 26px 60px rgba(50,38,24,0.22), inset 0 0 0 1px rgba(255,255,255,0.04)', boxSizing: 'border-box' }}>
        <div style={{ borderRadius: 34, overflow: 'hidden', background: 'var(--cn-bg)', display: 'flex', flexDirection: 'column', height: h || 'auto', minHeight: h || 'auto' }}>
          <StatusMini lang={lang} />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
        </div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cn-ink-soft)' }}>{label}</span>
    </div>
  );
}

// ---- page -----------------------------------------------------------
function Landing() {
  const [lang, setLang] = React.useState(() => { try { return localStorage.getItem('sm-lang') || 'ar'; } catch (e) { return 'ar'; } });
  const isAr = lang === 'ar';
  const t = STR[lang];
  React.useEffect(() => {
    try { localStorage.setItem('sm-lang', lang); } catch (e) {}
    document.documentElement.lang = lang; document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  }, [lang]);
  const fam = isAr ? "'Cairo', sans-serif" : "'Rubik', sans-serif";

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} style={{ ...themeVars(LT), background: 'var(--cn-bg)', minHeight: '100vh', fontFamily: fam, color: 'var(--cn-ink)' }}>
      {/* nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 20, background: 'color-mix(in srgb, var(--cn-bg) 82%, transparent)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid var(--cn-line)' }}>
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 24px' }}>
          <Mark size={30} />
          <span style={{ fontFamily: "'Rubik', sans-serif", fontSize: 17, fontWeight: 700, letterSpacing: '-.01em' }}>Spymaster Mission</span>
          <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', background: 'var(--cn-surface)', border: '1px solid var(--cn-line)', borderRadius: 999, padding: 3 }}>
              {[['ar', 'عربي'], ['en', 'EN']].map(([k, lab]) => (
                <button key={k} onClick={() => setLang(k)} style={{ all: 'unset', cursor: 'pointer', fontFamily: k === 'ar' ? "'Cairo', sans-serif" : "'Rubik', sans-serif", fontSize: 13, fontWeight: 700, padding: '5px 12px', borderRadius: 999, color: lang === k ? 'var(--cn-red-on)' : 'var(--cn-ink-soft)', background: lang === k ? 'var(--cn-red)' : 'transparent', transition: 'all .18s' }}>{lab}</button>
              ))}
            </div>
            <a className="btnP" href={PLAY_URL} style={{ fontSize: 14, padding: '8px 16px' }}>{t.play}</a>
          </div>
        </div>
      </nav>

      {/* hero */}
      <header className="wrap heroGrid" style={{ padding: '58px 24px 8px' }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cn-red-ink)', letterSpacing: isAr ? 0 : '.1em', textTransform: isAr ? 'none' : 'uppercase', marginBottom: 14 }}>{t.tag}</div>
          <h1 style={{ fontFamily: fam, fontSize: isAr ? 47 : 52, fontWeight: 700, lineHeight: 1.12, letterSpacing: isAr ? 0 : '-.02em', margin: '0 0 18px', textWrap: 'balance' }}>{t.h1}</h1>
          <p style={{ fontSize: 17.5, lineHeight: 1.6, color: 'var(--cn-ink-soft)', margin: '0 0 28px', maxWidth: 460 }}>{t.sub}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <a className="btnP" href={PLAY_URL} style={{ fontSize: 17, padding: '13px 26px' }}>{t.play}</a>
            <a className="btnS" href="#how" style={{ fontSize: 15, padding: '12px 20px' }}>{t.how}</a>
          </div>
          <div dir="ltr" style={{ marginTop: 18 }}><a href={PLAY_URL} style={{ fontFamily: "'DM Mono', monospace", fontSize: 12.5, textDecoration: 'none' }}>play.spymaster.elgemmy.com</a></div>
        </div>
        <MiniBoard lang={lang} t={t} />
      </header>

      <HoverRow lang={lang} />

      {/* how to play */}
      <section id="how" className="wrap" style={{ padding: '64px 24px 0' }}>
        <SectionHead isAr={isAr} title={t.howTitle} />
        <div className="stepGrid">
          {t.steps.map((s, i) => (
            <div key={i} style={{ background: 'var(--cn-surface)', border: '1px solid var(--cn-line)', borderRadius: 18, padding: '20px 20px 18px' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, color: 'var(--cn-red-ink)', marginBottom: 8 }}>{['01', '02', '03'][i]}</div>
              <StepVisual n={i} lang={lang} t={t} />
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '12px 0 6px' }}>{s.t}</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--cn-ink-soft)', margin: 0 }}>{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="wrap" style={{ padding: '64px 24px 0' }}>
        <SectionHead isAr={isAr} title={t.featTitle} />
        <div className="featGrid">
          {t.feats.map(f => (
            <div key={f.k} style={{ background: 'var(--cn-surface)', border: '1px solid var(--cn-line)', borderRadius: 18, padding: '18px 18px 16px' }}>
              <div style={{ height: 24, display: 'flex', alignItems: 'center', marginBottom: 10 }}><FeatIcon k={f.k} /></div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{f.t}</div>
              <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--cn-ink-soft)', margin: 0 }}>{f.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* live screens */}
      <section className="wrap" style={{ padding: '68px 24px 0' }}>
        <SectionHead isAr={isAr} title={t.screensTitle} />
        <div style={{ display: 'flex', gap: 34, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' }}>
          <PhoneFrame label={t.screens[0]} lang={lang}><Lobby theme={LT} lang={lang} /></PhoneFrame>
          <PhoneFrame label={t.screens[1]} lang={lang} h={664}><Board theme={LT} view="operative" lang={lang} /></PhoneFrame>
        </div>
      </section>

      {/* closing cta */}
      <section style={{ textAlign: 'center', padding: '76px 24px 84px' }}>
        <h2 style={{ fontFamily: fam, fontSize: 36, fontWeight: 700, margin: '0 0 8px' }}>{t.ctaTitle}</h2>
        <p style={{ fontSize: 16.5, color: 'var(--cn-ink-soft)', margin: '0 0 24px' }}>{t.ctaSub}</p>
        <a className="btnP" href={PLAY_URL} style={{ fontSize: 18, padding: '15px 34px' }}>{t.play}</a>
        <div dir="ltr" style={{ marginTop: 16 }}><a href={PLAY_URL} style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, textDecoration: 'none' }}>play.spymaster.elgemmy.com</a></div>
      </section>

      {/* footer */}
      <footer style={{ borderTop: '1px solid var(--cn-line)' }}>
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '22px 24px' }}>
          <Mark size={24} />
          <span style={{ fontFamily: "'Rubik', sans-serif", fontSize: 14, fontWeight: 700 }}>Spymaster Mission</span>
          <span style={{ fontSize: 13, color: 'var(--cn-ink-soft)' }}>· {t.credit}</span>
          <span dir="ltr" style={{ marginInlineStart: 'auto', fontFamily: "'DM Mono', monospace", fontSize: 12, color: 'var(--cn-ink-soft)' }}>© 2026 · <a href={PLAY_URL} style={{ textDecoration: 'none' }}>play.spymaster.elgemmy.com</a></span>
        </div>
      </footer>
    </div>
  );
}

Object.assign(window, { Landing });
