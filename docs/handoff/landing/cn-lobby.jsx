/* Codenames identity — Lobby screen + spymaster eye mark
   Exports (window): EyeMark, Lobby */

function EyeMark({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="spymaster">
      <path d="M2.6 12C5.6 6.6 18.4 6.6 21.4 12 18.4 17.4 5.6 17.4 2.6 12Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.1" fill={color} />
    </svg>
  );
}

// tiny 2x2 wordmark tile
function Mark({ size = 30 }) {
  const cell = (size - 4) / 2;
  const cols = ['var(--cn-red)', 'var(--cn-blue)', 'var(--cn-neutral)', 'var(--cn-assassin)'];
  return (
    <div style={{ width: size, height: size, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
      {cols.map((c, i) => <div key={i} style={{ background: c, borderRadius: 5 }} />)}
    </div>
  );
}

function PlayerChip({ name, you, lang }) {
  const isAr = lang === 'ar';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--cn-surface)', border: '1px solid var(--cn-line)', borderRadius: 10 }}>
      <div style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--cn-surface-2)', border: '1px solid var(--cn-line)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: 'var(--cn-ink-soft)', flex: '0 0 auto' }}>{name.slice(0, isAr ? 1 : 1)}</div>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cn-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
      {you && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--cn-ink-soft)', background: 'var(--cn-surface-2)', borderRadius: 999, padding: '1px 6px', flex: '0 0 auto' }}>{isAr ? 'أنت' : 'you'}</span>}
    </div>
  );
}

function TeamCard({ role, lang, title, spymaster, operatives, youKey, onJoin }) {
  const isAr = lang === 'ar';
  const fam = isAr ? "'Cairo', sans-serif" : "'Rubik', sans-serif";
  const count = 1 + operatives.length;
  return (
    <div style={{ flex: 1, minWidth: 0, background: `var(--cn-${role}-tint)`, border: `1.5px solid var(--cn-${role})`, borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 9, fontFamily: fam }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Glyph role={role} size={18} color={`var(--cn-${role})`} />
        <span style={{ fontSize: 14, fontWeight: 700, color: `var(--cn-${role}-ink)` }}>{title}</span>
        <span style={{ marginInlineStart: 'auto', fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, color: `var(--cn-${role}-ink)`, opacity: .8 }}>{count}</span>
      </div>

      {/* spymaster slot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--cn-surface)', border: `1.5px solid var(--cn-${role})`, borderRadius: 10 }}>
        <EyeMark size={17} color={`var(--cn-${role}-ink)`} />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cn-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{spymaster}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: `var(--cn-${role}-ink)`, letterSpacing: isAr ? 0 : '.03em' }}>{isAr ? 'سيّد التجسس' : 'SPYMASTER'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {operatives.map((o, i) => <PlayerChip key={i} name={o.name} you={o.you} lang={lang} />)}
      </div>

      <button onClick={onJoin} style={{ all: 'unset', cursor: 'pointer', textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: `var(--cn-${role}-ink)`, border: `1.5px dashed var(--cn-${role})`, borderRadius: 10, padding: '8px 0', opacity: .9 }}>
        {isAr ? '+ انضمّ كعميل' : '+ Join as operative'}
      </button>
    </div>
  );
}

function Seg({ options, value, onChange, lang }) {
  return (
    <div style={{ display: 'flex', background: 'var(--cn-surface-2)', border: '1px solid var(--cn-line)', borderRadius: 999, padding: 3, gap: 3 }}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700,
            padding: '8px 0', borderRadius: 999, transition: 'all .18s',
            background: on ? 'var(--cn-surface)' : 'transparent', color: on ? 'var(--cn-ink)' : 'var(--cn-ink-soft)',
            boxShadow: on ? '0 1px 4px rgba(60,45,30,.12)' : 'none',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function Lobby({ theme, lang = 'ar' }) {
  const [lng, setLng] = React.useState(lang);
  const [copied, setCopied] = React.useState(false);
  const isAr = lng === 'ar';
  const fam = isAr ? "'Cairo', sans-serif" : "'Rubik', sans-serif";
  const code = 'QMR-72K';

  const red = {
    title: isAr ? 'الفريق الأحمر' : 'Red team',
    spymaster: isAr ? 'سارة' : 'Sara',
    operatives: [{ name: isAr ? 'خالد' : 'Khaled', you: true }, { name: isAr ? 'ريم' : 'Reem' }],
  };
  const blue = {
    title: isAr ? 'الفريق الأزرق' : 'Blue team',
    spymaster: isAr ? 'عمر' : 'Omar',
    operatives: [{ name: isAr ? 'نورا' : 'Noura' }, { name: isAr ? 'يوسف' : 'Yousef' }],
  };

  const copy = () => { try { navigator.clipboard?.writeText(code); } catch (e) {} setCopied(true); setTimeout(() => setCopied(false), 1600); };

  const lbl = { fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: 'var(--cn-ink-soft)' };

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} style={{ ...themeVars(theme), background: 'var(--cn-bg)', width: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column', fontFamily: fam, color: 'var(--cn-ink)', padding: '18px 16px calc(18px + env(safe-area-inset-bottom))', boxSizing: 'border-box', gap: 16 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <Mark size={32} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ fontFamily: fam, fontSize: 18, fontWeight: 700 }}>{isAr ? 'اسم الرمز' : 'Codename'}</span>
          <span style={{ fontSize: 12, color: 'var(--cn-ink-soft)', fontWeight: 500 }}>{isAr ? 'غرفة العائلة' : 'Family room'}</span>
        </div>
        <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--cn-ink-soft)', background: 'var(--cn-surface)', border: '1px solid var(--cn-line)', borderRadius: 999, padding: '6px 11px' }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--cn-blue)' }} />
          {isAr ? '٥ متصلون' : '5 online'}
        </div>
      </div>

      {/* room code hero */}
      <div style={{ background: 'var(--cn-surface)', border: '1px solid var(--cn-line)', borderRadius: 'var(--cn-r-bar)', padding: '16px 16px 14px', boxShadow: '0 4px 16px rgba(60,45,30,0.06)' }}>
        <div style={{ ...lbl, marginBottom: 10 }}>{isAr ? 'رمز الغرفة' : 'ROOM CODE'}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span dir="ltr" style={{ fontFamily: "'DM Mono', monospace", fontSize: 34, fontWeight: 500, letterSpacing: '.06em', color: 'var(--cn-ink)' }}>{code}</span>
          <button onClick={copy} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: copied ? 'var(--cn-blue-ink)' : 'var(--cn-ink)', background: copied ? 'var(--cn-blue-tint)' : 'var(--cn-surface-2)', border: `1px solid ${copied ? 'var(--cn-blue)' : 'var(--cn-line)'}`, borderRadius: 999, padding: '9px 15px', transition: 'all .18s' }}>
            {copied
              ? (<><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>{isAr ? 'تم النسخ' : 'Copied'}</>)
              : (<><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="2" /><path d="M5 15.5V6a2.5 2.5 0 012.5-2.5H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>{isAr ? 'نسخ' : 'Copy'}</>)}
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--cn-ink-soft)', marginTop: 10, lineHeight: 1.4 }}>{isAr ? 'شارك الرمز لينضمّ اللاعبون من أجهزتهم.' : 'Share the code so players can join from their own phones.'}</div>
      </div>

      {/* language */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={lbl}>{isAr ? 'لغة اللوح' : 'BOARD LANGUAGE'}</div>
        <Seg lang={lng} value={lng} onChange={setLng} options={[{ id: 'ar', label: 'العربية' }, { id: 'en', label: 'English' }]} />
      </div>

      {/* teams */}
      <div style={{ display: 'flex', gap: 10 }}>
        <TeamCard role="red" lang={lng} {...red} onJoin={() => {}} />
        <TeamCard role="blue" lang={lng} {...blue} onJoin={() => {}} />
      </div>

      {/* start */}
      <button style={{ all: 'unset', cursor: 'pointer', textAlign: 'center', fontFamily: fam, fontSize: 17, fontWeight: 700, color: 'var(--cn-surface)', background: 'var(--cn-ink)', borderRadius: 'var(--cn-r-bar)', padding: '16px 0', marginTop: 2, boxShadow: '0 6px 18px rgba(43,38,34,0.22)' }}>
        {isAr ? 'ابدأ اللعب' : 'Start game'}
      </button>
    </div>
  );
}

Object.assign(window, { EyeMark, Lobby });
