'use client';

// ExamFormatCard: "Cấu trúc đề thi thật" — minimal diagram style.
// A proportional time bar (segment width ∝ minutes per part) + one-line
// part rows + ultra-short tips. Almost no prose: the shape IS the info.

import { CheckCircleIcon } from '@heroicons/react/24/outline';

export interface ExamStat {
  value: string;
  label: string;
}

export interface ExamPart {
  name: string;
  /** minutes — drives the time-bar segment width */
  minutes: number;
  /** compact label shown in the bar and the row, e.g. "20'", "≈15'" */
  time: string;
  /** compact label, e.g. "≥ 120 từ", "8 câu" */
  items: string;
}

export default function ExamFormatCard({
  icon: Icon,
  stats,
  parts,
  rules,
}: {
  icon: React.ElementType;
  stats: ExamStat[];
  parts: ExamPart[];
  rules: string[];
}) {
  return (
    <section className="card exam-format" aria-label="Cấu trúc đề thi thật">
      <div className="exam-format-head">
        <span className="icon-badge sm">
          <Icon width={18} height={18} strokeWidth={1.6} />
        </span>
        <strong>Cấu trúc đề thi thật</strong>
        <span className="exam-format-chips">
          {stats.map((s) => (
            <span className="chip" key={s.label}>
              <b>{s.value}</b>&nbsp;{s.label}
            </span>
          ))}
        </span>
      </div>

      {/* proportional time diagram */}
      <div
        className="timebar"
        role="img"
        aria-label={parts.map((p) => `${p.name}: ${p.time}`).join(' · ')}
      >
        {parts.map((p) => (
          <div
            key={p.name}
            className="tseg"
            style={{ flex: `${p.minutes} 1 0` }}
            title={`${p.name} — ${p.time}`}
          >
            {p.time}
          </div>
        ))}
      </div>

      {/* one-line part rows */}
      <div className="exam-rows">
        {parts.map((p, i) => (
          <div className="exam-row" key={p.name}>
            <span className="n">{String(i + 1).padStart(2, '0')}</span>
            <strong>{p.name}</strong>
            <span className="q">{p.items}</span>
            <span className="t">{p.time}</span>
          </div>
        ))}
      </div>

      {/* ultra-short tips */}
      <div className="exam-tips">
        {rules.map((r) => (
          <span key={r}>
            <CheckCircleIcon width={14} height={14} />
            {r}
          </span>
        ))}
      </div>
    </section>
  );
}
