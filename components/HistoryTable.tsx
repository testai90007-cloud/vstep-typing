'use client';

// Full test-history table for /lich-su: search, skill filter, sortable
// columns, expandable row detail, and per-row delete.

import { useMemo, useState, Fragment } from 'react';
import Link from 'next/link';
import {
  BookOpenIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  PencilSquareIcon,
  SpeakerWaveIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import {
  listeningTitle,
  readingTitle,
  writingTitle,
  type ListeningSession,
  type ReadingSession,
  type SpeakingSession,
  type WritingSession,
} from './ProgressDashboard';

export type SkillId = 'writing' | 'speaking' | 'listening' | 'reading';

export interface HistoryRow {
  key: string;
  id: number;
  skill: SkillId;
  title: string;
  /** raw test/template id — included in search so "rd-001" finds "Đề 001" */
  rawId: string;
  mode: string;
  scoreText: string;
  createdAt: string;
  retakeHref: string;
  retakeLabel: string;
  detail: React.ReactNode;
}

const SKILL_META: Record<SkillId, { label: string; short: string }> = {
  writing: { label: 'Viết', short: 'Viết' },
  speaking: { label: 'Nói', short: 'Nói' },
  listening: { label: 'Nghe', short: 'Nghe' },
  reading: { label: 'Đọc', short: 'Đọc' },
};

const MODE_LABEL: Record<string, string> = {
  practice: 'Luyện tập',
  mock: 'Thi thử',
  whole: 'Luyện tập',
  sections: 'Luyện tập',
  exam: 'Thi thử',
};

const SPEAK_CRIT: [string, string][] = [
  ['grammar', 'Ngữ pháp'],
  ['vocabulary', 'Từ vựng'],
  ['pronunciation', 'Phát âm'],
  ['fluency', 'Trôi chảy'],
  ['discourse_management', 'Mạch lạc'],
];

function fmtDateTime(iso: string): { d: string; t: string } {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return { d: '—', t: '' };
  return {
    d: dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    t: dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  };
}

function fmtDur(sec?: number | null): string {
  if (sec == null) return '–';
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, '0')}`;
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="hist-kv" style={{ padding: '5px 0' }}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

export function buildRows(data: {
  writing: WritingSession[];
  speaking: SpeakingSession[];
  listening: ListeningSession[];
  reading: ReadingSession[];
}): HistoryRow[] {
  const rows: HistoryRow[] = [];

  for (const s of data.writing) {
    const isTest = !!s.template_id && s.template_id.startsWith('de-');
    rows.push({
      key: `writing-${s.id}`,
      id: s.id,
      skill: 'writing',
      title: writingTitle(s.template_id),
      rawId: s.template_id || '',
      mode: MODE_LABEL[s.mode] || s.mode || '—',
      scoreText: s.accuracy != null ? `${Math.round(s.accuracy)}%` : '–',
      createdAt: s.created_at,
      retakeHref: isTest ? `/writing/de-thi/${s.template_id}` : '/writing',
      retakeLabel: 'Luyện lại',
      detail: (
        <>
          <KV k="Bài luyện" v={writingTitle(s.template_id)} />
          <KV k="Chế độ" v={MODE_LABEL[s.mode] || s.mode || '—'} />
          {s.accuracy != null && <KV k="Độ chính xác" v={`${Math.round(s.accuracy)}%`} />}
          <KV k="Thời lượng" v={fmtDur(s.duration_sec)} />
        </>
      ),
    });
  }

  for (const s of data.speaking) {
    rows.push({
      key: `speaking-${s.id}`,
      id: s.id,
      skill: 'speaking',
      title: `Part ${s.part} — ${(s.prompt || '').slice(0, 60)}${(s.prompt || '').length > 60 ? '…' : ''}`,
      rawId: `part ${s.part}`,
      mode: MODE_LABEL[s.mode || ''] || '—',
      scoreText: `${Number(s.overall || 0).toFixed(1)}/10`,
      createdAt: s.created_at,
      retakeHref: '/speaking',
      retakeLabel: 'Luyện tiếp',
      detail: (
        <>
          {s.scores && (
            <div style={{ display: 'grid', gap: 8, margin: '6px 0 10px' }}>
              {SPEAK_CRIT.map(([k, label]) => {
                const v = Number(s.scores[k] ?? 0);
                return (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem' }}>
                    <span style={{ width: 90, color: 'var(--muted)', flexShrink: 0 }}>{label}</span>
                    <span className="scorebar" style={{ flex: 1 }}>
                      <i style={{ width: `${Math.min(100, v * 10)}%` }} />
                    </span>
                    <b style={{ minWidth: 30, textAlign: 'right' }}>{v.toFixed(1)}</b>
                  </div>
                );
              })}
            </div>
          )}
          {s.transcript && (
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
                Bài nói của bạn
              </summary>
              <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.7, marginTop: 6 }}>
                {s.transcript}
              </p>
            </details>
          )}
          {s.feedback && (
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
                Nhận xét của AI
              </summary>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.7, marginTop: 6 }}>
                {s.feedback}
              </p>
            </details>
          )}
        </>
      ),
    });
  }

  for (const s of data.listening) {
    const pct = s.total > 0 ? Math.round((s.score / s.total) * 100) : 0;
    rows.push({
      key: `listening-${s.id}`,
      id: s.id,
      skill: 'listening',
      title: listeningTitle(s.test_id),
      rawId: s.test_id || '',
      mode: MODE_LABEL[s.mode || ''] || '—',
      scoreText: `${s.score}/${s.total}`,
      createdAt: s.created_at,
      retakeHref: `/listening/${s.test_id}`,
      retakeLabel: 'Làm lại đề này',
      detail: (
        <>
          <KV k="Kết quả" v={`${s.score}/${s.total} · ${pct}% câu đúng`} />
          <KV k="Thời lượng" v={fmtDur(s.duration_sec)} />
        </>
      ),
    });
  }

  for (const s of data.reading) {
    const pct = s.total > 0 ? Math.round((s.score / s.total) * 100) : 0;
    rows.push({
      key: `reading-${s.id}`,
      id: s.id,
      skill: 'reading',
      title: readingTitle(s.test_id),
      rawId: s.test_id || '',
      mode: MODE_LABEL[s.mode || ''] || '—',
      scoreText: `${s.score}/${s.total}`,
      createdAt: s.created_at,
      retakeHref: `/reading/${s.test_id}`,
      retakeLabel: 'Làm lại đề này',
      detail: (
        <>
          <KV k="Kết quả" v={`${s.score}/${s.total} · ${pct}% câu đúng`} />
          <KV k="Thời lượng" v={fmtDur(s.duration_sec)} />
        </>
      ),
    });
  }

  return rows.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export default function HistoryTable({
  data,
  onDelete,
}: {
  data: {
    writing: WritingSession[];
    speaking: SpeakingSession[];
    listening: ListeningSession[];
    reading: ReadingSession[];
  };
  onDelete: (skill: SkillId, id: number) => Promise<boolean>;
}) {
  const [query, setQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState<'all' | SkillId>('all');
  const [sortKey, setSortKey] = useState<'date' | 'title'>('date');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const rows = useMemo(() => buildRows(data), [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter(
      (r) =>
        (skillFilter === 'all' || r.skill === skillFilter) &&
        (q === '' || `${r.title} ${r.rawId}`.toLowerCase().includes(q))
    );
    list = [...list].sort((a, b) => {
      if (sortKey === 'title') {
        return a.title.localeCompare(b.title, 'vi') * sortDir;
      }
      return (
        (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortDir
      );
    });
    return list;
  }, [rows, query, skillFilter, sortKey, sortDir]);

  const toggleSort = (key: 'date' | 'title') => {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' ? -1 : 1);
    }
  };

  const handleDelete = async (row: HistoryRow) => {
    const ok = window.confirm(`Xóa bản ghi "${row.title}"? Hành động này không thể hoàn tác.`);
    if (!ok) return;
    setDeleting(row.key);
    const done = await onDelete(row.skill, row.id);
    setDeleting(null);
    if (!done) {
      window.alert('Xóa thất bại, vui lòng thử lại.');
    }
  };

  const sortIcon = (key: 'date' | 'title') =>
    sortKey === key ? (sortDir === 1 ? ' ↑' : ' ↓') : '';

  return (
    <>
      <div className="hist-tools">
        <label className="hist-search">
          <MagnifyingGlassIcon width={17} height={17} style={{ color: 'var(--faint)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên đề…"
            aria-label="Tìm theo tên đề"
          />
        </label>
        <select
          className="hist-select"
          value={skillFilter}
          onChange={(e) => setSkillFilter(e.target.value as 'all' | SkillId)}
          aria-label="Lọc theo kỹ năng"
        >
          <option value="all">Tất cả kỹ năng</option>
          <option value="writing">Viết</option>
          <option value="speaking">Nói</option>
          <option value="listening">Nghe</option>
          <option value="reading">Đọc</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card empty" style={{ marginTop: 12, textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--muted)' }}>
            {rows.length === 0
              ? 'Chưa có bài làm nào được lưu.'
              : 'Không tìm thấy bài làm nào khớp.'}
          </p>
        </div>
      ) : (
        <div className="hist-tablewrap">
          <table className="hist-table">
            <thead>
              <tr>
                <th
                  className="sortable"
                  onClick={() => toggleSort('date')}
                  title="Sắp xếp theo ngày"
                >
                  Ngày làm{sortIcon('date')}
                </th>
                <th
                  className="sortable"
                  onClick={() => toggleSort('title')}
                  title="Sắp xếp theo tên đề"
                >
                  Đề thi{sortIcon('title')}
                </th>
                <th>Kỹ năng</th>
                <th>Chế độ</th>
                <th>Điểm</th>
                <th style={{ textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const { d, t } = fmtDateTime(row.createdAt);
                const open = openKey === row.key;
                return (
                  <Fragment key={row.key}>
                    <tr className={open ? 'row-open' : ''}>
                      <td>
                        <span className="hist-datecell">
                          <b>{d}</b>
                          <i>{t}</i>
                        </span>
                      </td>
                      <td>
                        <span className="hist-titlecell">{row.title}</span>
                      </td>
                      <td>
                        <span className={`skill-badge ${row.skill}`}>
                          {SKILL_META[row.skill].short}
                        </span>
                      </td>
                      <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{row.mode}</td>
                      <td>
                        <span className="hist-scorecell">{row.scoreText}</span>
                      </td>
                      <td>
                        <span className="hist-actions" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="icon-btn"
                            title="Xem chi tiết"
                            aria-label={`Xem chi tiết ${row.title}`}
                            onClick={() => setOpenKey(open ? null : row.key)}
                          >
                            <EyeIcon width={17} height={17} />
                          </button>
                          <button
                            className="icon-btn danger"
                            title="Xóa bản ghi"
                            aria-label={`Xóa ${row.title}`}
                            disabled={deleting === row.key}
                            onClick={() => handleDelete(row)}
                          >
                            <TrashIcon width={17} height={17} />
                          </button>
                        </span>
                      </td>
                    </tr>
                    {open && (
                      <tr className="hist-detail-row">
                        <td colSpan={6}>
                          {row.detail}
                          <div style={{ marginTop: 10 }}>
                            <Link href={row.retakeHref} className="btn" style={{ textDecoration: 'none', fontSize: '0.85rem' }}>
                              {row.retakeLabel}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="hist-count">
        Hiển thị <b>{filtered.length}</b> / {rows.length} dòng
      </p>
    </>
  );
}
