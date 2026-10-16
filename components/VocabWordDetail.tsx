'use client';

// Chi tiết 1 từ — dùng chung cho /tu-vung/tu/[word].
// Nhận prop word, tự fetch nghĩa + gốc từ qua contract của Agent A.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { getVocabLevel, type VocabDefinition, type VocabEtymology } from '@/lib/vocab';
import { fetchDefine, fetchEtymology, saveAnswer } from '@/lib/vocab-client';

type DefState = 'loading' | 'loaded' | 'not-found' | 'error';
type EtymState = 'idle' | 'loading' | 'loaded' | 'not-found' | 'error';

function ChipLink({ word, children }: { word: string; children: React.ReactNode }) {
  return (
    <Link
      href={`/tu-vung/tu/${encodeURIComponent(word)}`}
      className="chip"
      style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
    >
      {children}
    </Link>
  );
}

export default function VocabWordDetail({ word }: { word: string }) {
  const level = getVocabLevel(word);
  const [def, setDef] = useState<VocabDefinition | null>(null);
  const [defState, setDefState] = useState<DefState>('loading');
  const [etym, setEtym] = useState<VocabEtymology | null>(null);
  const [etymState, setEtymState] = useState<EtymState>('idle');
  const [saved, setSaved] = useState<{
    kind: 'remembered' | 'forgotten';
    gained: number;
    leveledUp: boolean;
    newLevel: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadDef = () => {
    setDefState('loading');
    setDef(null);
    fetchDefine(word)
      .then((d) => {
        if (!d || !d.found) {
          setDefState('not-found');
          return;
        }
        setDef(d);
        setDefState('loaded');
      })
      .catch(() => setDefState('error'));
  };

  useEffect(() => {
    loadDef();
    setEtym(null);
    setEtymState('idle');
    setSaved(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word]);

  const loadEtym = () => {
    setEtymState('loading');
    setEtym(null);
    fetchEtymology(word)
      .then((e) => {
        if (!e || !e.found) {
          setEtymState('not-found');
          return;
        }
        setEtym(e);
        setEtymState('loaded');
      })
      .catch(() => setEtymState('error'));
  };

  const mark = (remembered: boolean) => {
    setSaving(true);
    saveAnswer(word, remembered, 'flashcard')
      .then((res) => {
        setSaved({
          kind: remembered ? 'remembered' : 'forgotten',
          gained: res?.gained ?? 0,
          leveledUp: res?.leveledUp ?? false,
          newLevel: res?.newLevel ?? 0,
        });
      })
      .catch(() => {
        /* lỗi lưu — trạng thái nút giữ nguyên để user thử lại */
      })
      .finally(() => setSaving(false));
  };

  const synonyms = def?.synonyms ?? [];
  const antonyms = def?.antonyms ?? [];
  const hasRelated = synonyms.length > 0 || antonyms.length > 0;

  return (
    <main className="page">
      <div className="nav-top">
        <Link href="/tu-vung" className="back">
          <ArrowLeftIcon width={16} height={16} />
          Từ vựng
        </Link>
      </div>
      <p className="page-eyebrow">Từ vựng — {level ?? 'Ngoài list'}</p>
      <h1 className="page-title" style={{ overflowWrap: 'break-word' }}>
        {word}
      </h1>

      <section aria-label="Nghĩa của từ" className="card-soft" style={{ padding: 20 }}>
        {defState === 'loading' ? (
          <div aria-live="polite" aria-busy="true">
            <p style={{ color: 'var(--faint)', margin: 0 }}>Đang tải nghĩa…</p>
            <p style={{ color: 'var(--faint)', margin: '8px 0 0' }}>Đang tải ví dụ…</p>
          </div>
        ) : defState === 'error' ? (
          <div aria-live="polite">
            <p style={{ margin: 0 }}>Không tải được nghĩa của từ này.</p>
            <button type="button" className="btn" onClick={loadDef} style={{ marginTop: 12 }}>
              Thử lại
            </button>
          </div>
        ) : defState === 'not-found' ? (
          <p aria-live="polite" style={{ margin: 0, color: 'var(--muted)' }}>
            Chưa có định nghĩa cho từ này trong từ điển. Bạn vẫn có thể tra gốc từ bên dưới
            hoặc học từ khác.
          </p>
        ) : def ? (
          <div>
            {def.phonetic ? (
              <p style={{ margin: '0 0 12px', color: 'var(--muted)' }}>{def.phonetic}</p>
            ) : null}
            {def.audio ? (
              <div>
                <audio ref={audioRef} preload="none" src={def.audio} />
                <button
                  type="button"
                  className="btn"
                  aria-label={`Nghe phát âm từ ${word}`}
                  onClick={() => audioRef.current?.play().catch(() => {})}
                >
                  Nghe phát âm
                </button>
              </div>
            ) : null}
            {def.meanings.map((m, i) => (
              <div key={`${m.pos}-${i}`} style={{ marginTop: 20 }}>
                <h2 style={{ fontSize: '0.9rem', color: 'var(--muted)', margin: '0 0 8px' }}>
                  {m.pos}
                </h2>
                {m.definitions.slice(0, 2).map((d, j) => (
                  <div key={j} style={{ marginBottom: 12 }}>
                    <p style={{ margin: 0 }}>{d.definition}</p>
                    {d.example ? (
                      <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontStyle: 'italic' }}>
                        “{d.example}”
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <div className="btn-row" style={{ marginTop: 20 }}>
        <button
          type="button"
          className="btn primary"
          disabled={saving}
          onClick={() => mark(true)}
          aria-label={`Đánh dấu đã nhớ từ ${word}`}
        >
          Đã nhớ
        </button>
        <button
          type="button"
          className="btn"
          disabled={saving}
          onClick={() => mark(false)}
          aria-label={`Đánh dấu chưa nhớ từ ${word}`}
        >
          Chưa nhớ
        </button>
      </div>
      <p aria-live="polite" style={{ minHeight: 20, margin: '8px 0 0', fontSize: '0.88rem', color: 'var(--muted)' }}>
        {saved
          ? saved.kind === 'remembered'
            ? `Đã lưu: bạn đã nhớ từ này.${saved.gained > 0 ? ` +${saved.gained} XP.` : ''}${saved.leveledUp ? ` Lên cấp ${saved.newLevel}!` : ''}`
            : 'Đã lưu: từ này sẽ xuất hiện lại khi ôn tập.'
          : ''}
      </p>

      {defState === 'loaded' && hasRelated ? (
        <section aria-label="Từ đồng nghĩa và trái nghĩa" style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 12px' }}>Từ đồng nghĩa / Từ trái nghĩa</h2>
          {synonyms.length > 0 ? (
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 8px', fontSize: '0.88rem', color: 'var(--muted)' }}>
                Đồng nghĩa
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {synonyms.map((s) => (
                  <ChipLink key={`syn-${s}`} word={s}>
                    {s}
                  </ChipLink>
                ))}
              </div>
            </div>
          ) : null}
          {antonyms.length > 0 ? (
            <div>
              <p style={{ margin: '0 0 8px', fontSize: '0.88rem', color: 'var(--muted)' }}>
                Trái nghĩa
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {antonyms.map((a) => (
                  <ChipLink key={`ant-${a}`} word={a}>
                    {a}
                  </ChipLink>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-label="Gốc từ" style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 12px' }}>Gốc từ</h2>
        {etymState === 'idle' ? (
          <button type="button" className="btn" onClick={loadEtym}>
            Xem gốc từ
          </button>
        ) : etymState === 'loading' ? (
          <p aria-live="polite" aria-busy="true" style={{ color: 'var(--faint)', margin: 0 }}>
            Đang tải gốc từ…
          </p>
        ) : etymState === 'error' ? (
          <div aria-live="polite">
            <p style={{ margin: 0 }}>Không tải được gốc từ.</p>
            <button type="button" className="btn" onClick={loadEtym} style={{ marginTop: 12 }}>
              Thử lại
            </button>
          </div>
        ) : etymState === 'not-found' ? (
          <div aria-live="polite">
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              Chưa có dữ liệu gốc từ cho từ này trong Wiktionary.
            </p>
            <a
              href={`https://www.etymonline.com/word/${encodeURIComponent(word)}`}
              target="_blank"
              rel="noreferrer"
              className="btn"
              style={{ marginTop: 12, textDecoration: 'none' }}
            >
              Xem đầy đủ tại Etymonline ↗
            </a>
          </div>
        ) : etym ? (
          <div aria-live="polite">
            {etym.chain.length > 0 ? (
              <p style={{ margin: '0 0 10px', lineHeight: 1.8 }}>
                {etym.chain.map((step, i) => (
                  <span key={`${step.lang}-${step.term}-${i}`}>
                    {i > 0 ? (
                      <span aria-hidden="true" style={{ color: 'var(--muted)' }}>
                        {' → '}
                      </span>
                    ) : null}
                    <span style={{ color: 'var(--muted)' }}>{step.lang}</span>{' '}
                    <em>{step.term}</em>
                  </span>
                ))}
              </p>
            ) : null}
            {etym.text ? <p style={{ margin: '0 0 12px', lineHeight: 1.7 }}>{etym.text}</p> : null}
            <a
              href={`https://www.etymonline.com/word/${encodeURIComponent(word)}`}
              target="_blank"
              rel="noreferrer"
              className="btn"
              style={{ textDecoration: 'none' }}
            >
              Xem đầy đủ tại Etymonline ↗
            </a>
          </div>
        ) : null}
      </section>
    </main>
  );
}
