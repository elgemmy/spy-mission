/* Codenames identity — themeable component library
   Exports (window): THEMES, themeVars, Glyph, Card, Board, IdentitySheet, BOARD_AR, BOARD_EN */

// ---------------------------------------------------------------- data
// 5x5 board: red 9, blue 8, neutral 7, assassin 1. `r` = pre-revealed.
const LAYOUT = [
  { role: 'red',     r: true  }, { role: 'blue',    r: false }, { role: 'neutral', r: false }, { role: 'red',     r: true  }, { role: 'blue',    r: false },
  { role: 'neutral', r: false }, { role: 'red',     r: false }, { role: 'blue',    r: true  }, { role: 'neutral', r: false }, { role: 'red',     r: false },
  { role: 'blue',    r: false }, { role: 'neutral', r: true  }, { role: 'assassin',r: false }, { role: 'red',     r: false }, { role: 'blue',    r: false },
  { role: 'neutral', r: false }, { role: 'red',     r: false }, { role: 'blue',    r: false }, { role: 'neutral', r: false }, { role: 'red',     r: false },
  { role: 'blue',    r: false }, { role: 'neutral', r: false }, { role: 'red',     r: false }, { role: 'blue',    r: false }, { role: 'red',     r: false },
];
const WORDS_AR = ['قطار','بحر','نجمة','قمر','كتاب','باب','شمس','ملك','جبل','نهر','وردة','حصان','سيف','ذهب','طائر','سمكة','بيت','شجرة','غابة','مفتاح','ساعة','قلب','ثعلب','جسر','نار'];
const WORDS_EN = ['TRAIN','OCEAN','STAR','MOON','BOOK','DOOR','SUN','KING','MOUNT','RIVER','ROSE','HORSE','SWORD','GOLD','BIRD','FISH','HOUSE','TREE','FOREST','KEY','CLOCK','HEART','FOX','BRIDGE','FIRE'];
const BOARD_AR = LAYOUT.map((c, i) => ({ ...c, word: WORDS_AR[i] }));
const BOARD_EN = LAYOUT.map((c, i) => ({ ...c, word: WORDS_EN[i] }));

// ---------------------------------------------------------------- themes
const THEMES = {
  sand: {
    key: 'sand', name: 'Warm Sand', ar: 'مقهى', tag: 'Desert-warm & cozy',
    v: {
      '--cn-bg': '#f1e8da', '--cn-surface': '#fdfaf3', '--cn-surface-2': '#f6efe2',
      '--cn-ink': '#2f2a24', '--cn-ink-soft': '#7d7263', '--cn-line': '#e4dac8',
      '--cn-red': '#c8553d', '--cn-red-ink': '#9a3b28', '--cn-red-tint': '#f4ddd4', '--cn-red-on': '#fdf3ec',
      '--cn-blue': '#2f7e8c', '--cn-blue-ink': '#1f5a66', '--cn-blue-tint': '#d8e9eb', '--cn-blue-on': '#eef7f8',
      '--cn-neutral': '#cba968', '--cn-neutral-ink': '#7a5e2e', '--cn-neutral-tint': '#efe5cd', '--cn-neutral-on': '#2f2616',
      '--cn-assassin': '#2b2622', '--cn-assassin-ink': '#2b2622', '--cn-assassin-tint': '#d8cfc4', '--cn-assassin-on': '#f0e9dd',
      '--cn-r-card': '12px', '--cn-r-chip': '999px', '--cn-r-bar': '18px',
    },
  },
  pop: { /* omitted: not used by landing */ },
  yasmeen: { /* omitted: not used by landing */ },
};
const themeVars = (t) => ({ ...t.v });

const ROLE_LABEL = { red: { ar: 'عميل أحمر', en: 'Red agent' }, blue: { ar: 'عميل أزرق', en: 'Blue agent' }, neutral: { ar: 'مارّ', en: 'Bystander' }, assassin: { ar: 'القاتل', en: 'Assassin' } };

// ---------------------------------------------------------------- glyphs
// Four maximally-distinct silhouettes so state never depends on colour alone:
// red = triangle, blue = disc, neutral = hollow ring-square, assassin = hazard X.
function Glyph({ role, size = 22, color = 'currentColor', stroke }) {
  const sw = size * 0.13;
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' };
  if (role === 'red') {
    return (
      <svg {...common} aria-label="red"><path d="M12 4.2 L20.2 19 H3.8 Z" fill={color} stroke={color} strokeWidth={sw} strokeLinejoin="round" /></svg>
    );
  }
  if (role === 'blue') {
    return (
      <svg {...common} aria-label="blue"><circle cx="12" cy="12" r="7.4" fill={color} /></svg>
    );
  }
  if (role === 'neutral') {
    return (
      <svg {...common} aria-label="neutral"><rect x="5.2" y="5.2" width="13.6" height="13.6" rx="4.2" fill="none" stroke={color} strokeWidth={sw * 1.15} /></svg>
    );
  }
  // assassin — stop-sign octagon + X
  return (
    <svg {...common} aria-label="assassin">
      <path d="M8.3 3.6 h7.4 L20.4 8.3 v7.4 L15.7 20.4 h-7.4 L3.6 15.7 v-7.4 Z" fill="none" stroke={color} strokeWidth={sw * 0.92} strokeLinejoin="round" />
      <path d="M9.2 9.2 L14.8 14.8 M14.8 9.2 L9.2 14.8" stroke={color} strokeWidth={sw * 1.25} strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------- card
// states: 'idle' (operative unrevealed), 'spy' (spymaster unrevealed, tinted),
// 'revealed' (flipped to faction). `lang` 'ar'|'en'. `dense` for board grid.
function Card({ word, role, state, lang = 'ar', dense = false, onReveal, flip = true }) {
  const isAr = lang === 'ar';
  const revealed = state === 'revealed';
  const fontFam = isAr ? "'Cairo', sans-serif" : "'Rubik', sans-serif";
  const wordSize = dense ? (isAr ? 17 : 13) : (isAr ? 30 : 24);
  const pad = dense ? 4 : 10;

  // front face = operative idle OR spymaster tinted
  const spy = state === 'spy';
  const frontBg = spy ? `var(--cn-${role}-tint)` : 'var(--cn-surface)';
  const frontInk = spy ? `var(--cn-${role}-ink)` : 'var(--cn-ink)';

  const faceBase = {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 'var(--cn-r-card)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
    padding: pad, boxSizing: 'border-box', overflow: 'hidden',
  };

  const front = (
    <div style={{
      ...faceBase, background: frontBg, color: frontInk,
      border: spy ? `1.5px solid var(--cn-${role})` : '1px solid var(--cn-line)',
      boxShadow: spy ? `inset 0 3px 0 var(--cn-${role})` : 'inset 0 -2px 0 rgba(0,0,0,0.05)',
    }}>
      {spy && (
        <div style={{ position: 'absolute', top: dense ? 3 : 7, insetInlineStart: dense ? 4 : 8, opacity: 0.92 }}>
          <Glyph role={role} size={dense ? 11 : 18} color={`var(--cn-${role})`} />
        </div>
      )}
      <span style={{ fontFamily: fontFam, fontWeight: 600, fontSize: wordSize, lineHeight: 1.05, textAlign: 'center', letterSpacing: isAr ? 0 : '.01em' }}>{word}</span>
    </div>
  );

  const back = (
    <div style={{
      ...faceBase, background: `var(--cn-${role})`, color: `var(--cn-${role}-on)`,
      transform: 'rotateY(180deg)', flexDirection: 'column', gap: dense ? 1 : 6,
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 -3px 6px rgba(0,0,0,0.12)',
    }}>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: 0.18 }}>
        <Glyph role={role} size={dense ? 40 : 92} color={`var(--cn-${role}-on)`} />
      </div>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: dense ? 1 : 5 }}>
        <Glyph role={role} size={dense ? 14 : 26} color={`var(--cn-${role}-on)`} />
        <span style={{ fontFamily: fontFam, fontWeight: 700, fontSize: wordSize, lineHeight: 1.05, textAlign: 'center' }}>{word}</span>
      </div>
    </div>
  );

  const flipNeeded = flip;
  return (
    <button
      onClick={onReveal}
      style={{
        all: 'unset', position: 'relative', display: 'block', width: '100%', aspectRatio: dense ? '1 / 0.92' : '1.35 / 1',
        cursor: onReveal && !revealed ? 'pointer' : 'default', perspective: 600, fontFamily: fontFam,
      }}
    >
      <div style={{
        position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d',
        transition: flipNeeded ? 'transform 190ms cubic-bezier(.34,1.2,.46,1)' : 'none',
        transform: revealed ? 'rotateY(180deg)' : 'none',
        filter: revealed ? 'none' : 'drop-shadow(0 2px 3px rgba(60,45,30,0.10))',
      }}>
        {front}
        {back}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------- chips / bars
function CountChip({ role, n, active, lang }) {
  const isAr = lang === 'ar';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px 6px 10px',
      borderRadius: 'var(--cn-r-chip)', background: active ? `var(--cn-${role})` : `var(--cn-${role}-tint)`,
      color: active ? `var(--cn-${role}-on)` : `var(--cn-${role}-ink)`,
      boxShadow: active ? `0 2px 8px color-mix(in srgb, var(--cn-${role}) 45%, transparent)` : 'none',
      transition: 'all .2s',
    }}>
      <Glyph role={role} size={16} color={active ? `var(--cn-${role}-on)` : `var(--cn-${role})`} />
      <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 18, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
    </div>
  );
}

// ---------------------------------------------------------------- board screen
function Board({ theme, view = 'operative', lang = 'ar' }) {
  const isAr = lang === 'ar';
  const data = isAr ? BOARD_AR : BOARD_EN;
  const [revealed, setRevealed] = React.useState(() => new Set(data.map((c, i) => (c.r ? i : null)).filter(x => x !== null)));
  const redLeft = data.filter((c, i) => c.role === 'red' && !revealed.has(i)).length;
  const blueLeft = data.filter((c, i) => c.role === 'blue' && !revealed.has(i)).length;
  const fam = isAr ? "'Cairo', sans-serif" : "'Rubik', sans-serif";

  const cardState = (c, i) => {
    if (revealed.has(i)) return 'revealed';
    return view === 'spymaster' ? 'spy' : 'idle';
  };
  const reveal = (i) => view === 'operative' ? setRevealed(s => { const n = new Set(s); n.add(i); return n; }) : null;

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} style={{ ...themeVars(theme), background: 'var(--cn-bg)', width: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column', fontFamily: fam, color: 'var(--cn-ink)' }}>
      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', gap: 8 }}>
        <CountChip role="red" n={redLeft} active lang={lang} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 11, color: 'var(--cn-ink-soft)', fontWeight: 600, letterSpacing: isAr ? 0 : '.04em' }}>{isAr ? 'الدور الآن' : 'NOW PLAYING'}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cn-red-ink)' }}>{isAr ? 'دور الأحمر' : "Red's turn"}</span>
        </div>
        <CountChip role="blue" n={blueLeft} lang={lang} />
      </div>

      {/* board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, padding: '6px 12px 12px' }}>
        {data.map((c, i) => (
          <Card key={i} word={c.word} role={c.role} state={cardState(c, i)} lang={lang} dense onReveal={() => reveal(i)} />
        ))}
      </div>

      {/* clue bar */}
      <div style={{ marginTop: 'auto', padding: '12px 14px calc(12px + env(safe-area-inset-bottom))' }}>
        <div style={{ background: 'var(--cn-surface)', border: '1px solid var(--cn-line)', borderRadius: 'var(--cn-r-bar)', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, boxShadow: '0 4px 14px rgba(60,45,30,0.06)' }}>
          {view === 'operative' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 12, color: 'var(--cn-ink-soft)', fontWeight: 600 }}>{isAr ? 'التلميح' : 'CLUE'}</span>
                <span style={{ fontSize: 22, fontWeight: 700 }}>{isAr ? 'ماء' : 'WATER'}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 500, color: 'var(--cn-red-ink)', background: 'var(--cn-red-tint)', borderRadius: 8, padding: '2px 9px' }}>3</span>
              </div>
              <button style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: 'var(--cn-ink-soft)', background: 'var(--cn-surface-2)', border: '1px solid var(--cn-line)', borderRadius: 999, padding: '8px 14px' }}>{isAr ? 'إنهاء الدور' : 'End turn'}</button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 12, color: 'var(--cn-ink-soft)', fontWeight: 600 }}>{isAr ? 'سيّد التجسس — أعطِ تلميحًا' : 'Spymaster — give a clue'}</span>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--cn-ink-soft)', opacity: .6 }}>{isAr ? 'اكتب كلمة…' : 'Type a word…'}</span>
              </div>
              <button style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: 'var(--cn-red-on)', background: 'var(--cn-red)', borderRadius: 999, padding: '9px 18px' }}>{isAr ? 'إرسال' : 'Send'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { THEMES, themeVars, Glyph, Card, Board, BOARD_AR, BOARD_EN });
