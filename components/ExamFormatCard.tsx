'use client';

// ExamFormatCard: shared "Cấu trúc đề thi thật" info card used on the four
// skill landing pages (writing / speaking / listening / reading).
// Redesigned as an exam "journey": numbered step cards linked by arrows,
// each with time + item-count pills — scannable at a glance.

import { Fragment } from 'react';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

export interface ExamStat {
  value: string;
  label: string;
}

export interface ExamPart {
  name: string;
  /** e.g. "20 phút" or "1' chuẩn bị + 3' nói" */
  time: string;
  /** e.g. "8 câu", "≥ 120 từ", "1 tình huống" */
  items: string;
  desc: string;
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

      <div className="exam-steps">
        {parts.map((p, i) => (
          <Fragment key={p.name}>
            <div className="exam-step">
              <span className="step-num">{String(i + 1).padStart(2, '0')}</span>
              <div className="step-main">
                <strong>{p.name}</strong>
                <p>{p.desc}</p>
                <div className="step-pills">
                  <span className="step-pill">
                    <ClockIcon width={13} height={13} />
                    {p.time}
                  </span>
                  <span className="step-pill">
                    <QuestionMarkCircleIcon width={13} height={13} />
                    {p.items}
                  </span>
                </div>
              </div>
            </div>
            {i < parts.length - 1 && (
              <div className="step-arrow" aria-hidden="true">
                <ArrowRightIcon width={18} height={18} />
              </div>
            )}
          </Fragment>
        ))}
      </div>

      <ul className="exam-rules">
        {rules.map((r) => (
          <li key={r}>
            <CheckCircleIcon width={15} height={15} />
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
