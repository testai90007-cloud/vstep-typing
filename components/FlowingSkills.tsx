'use client';

// FlowingSkills — homepage centerpiece.
// Four skills shown LARGE in the center, flowing-menu style: hovering a row
// sweeps a marquee band across it. Clicking a row slides the menu to the left
// and reveals that skill's tab (details + entry button). Clicking the active
// row again (or the ×) slides the menu back to center.

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRightIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Skill {
  id: string;
  no: string;
  name: string;
  short: string;
  href: string;
  count: string;
  desc: string;
  facts: [string, string][];
}

const SKILLS: Skill[] = [
  {
    id: 'writing',
    no: '01',
    name: 'Luyện Viết',
    short: 'VIẾT',
    href: '/writing',
    count: '300 đề',
    desc: 'Task 1 viết thư/email và Task 2 viết luận — đúng 60 phút như thi thật, AI chấm điểm từng part.',
    facts: [
      ['Số đề', '300'],
      ['Thời gian', '60 phút'],
      ['Cấu trúc', 'Task 1 (20′) + Task 2 (40′)'],
      ['Chấm điểm', 'AI theo 5 tiêu chí'],
    ],
  },
  {
    id: 'speaking',
    no: '02',
    name: 'Luyện Nói',
    short: 'NÓI',
    href: '/speaking',
    count: '302 đề',
    desc: 'Đủ 3 parts với bấm giờ chuẩn — ghi âm từng part, AI chấm theo 5 tiêu chí VSTEP.',
    facts: [
      ['Số đề', '302'],
      ['Thời gian', '12 phút'],
      ['Cấu trúc', 'Part 1 (3′) + Part 2 (4′) + Part 3 (5′)'],
      ['Chấm điểm', 'AI qua ghi âm'],
    ],
  },
  {
    id: 'listening',
    no: '03',
    name: 'Luyện Nghe',
    short: 'NGHE',
    href: '/listening',
    count: '56 đề',
    desc: '35 câu mỗi đề, bấm giờ 40 phút — xem lại transcript và đáp án ngay sau khi nộp.',
    facts: [
      ['Số đề', '56'],
      ['Thời gian', '40 phút'],
      ['Cấu trúc', '35 câu / đề'],
      ['Ôn tập', 'Transcript đầy đủ'],
    ],
  },
  {
    id: 'reading',
    no: '04',
    name: 'Luyện Đọc',
    short: 'ĐỌC',
    href: '/reading',
    count: '200 đề',
    desc: '4 bài đọc × 10 câu mỗi đề, bấm giờ 60 phút — chấm điểm tự động tức thì.',
    facts: [
      ['Số đề', '200'],
      ['Thời gian', '60 phút'],
      ['Cấu trúc', '4 bài đọc × 10 câu'],
      ['Chấm điểm', 'Tự động tức thì'],
    ],
  },
];

/** Seamless looping marquee band shown on row hover. */
function Marquee({ text }: { text: string }) {
  const seq = `${text} · ${text} · ${text} · ${text} · `;
  return (
    <span className="flow-marquee" aria-hidden="true">
      <span className="flow-track">
        <span>{seq}</span>
        <span>{seq}</span>
      </span>
    </span>
  );
}

function SkillPanel({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  return (
    <div className="flow-panel-inner" key={skill.id}>
      <button type="button" className="flow-close" onClick={onClose} aria-label="Thu gọn menu">
        <XMarkIcon width={18} height={18} />
      </button>
      <p className="flow-eyebrow">{skill.no} — Kỹ năng</p>
      <h3 className="flow-panel-title">{skill.name}</h3>
      <p className="flow-panel-desc">{skill.desc}</p>
      <dl className="flow-facts">
        {skill.facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <Link href={skill.href} className="btn primary">
        Bắt đầu luyện
        <ArrowRightIcon width={16} height={16} />
      </Link>
    </div>
  );
}

export default function FlowingSkills() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className={`flow-stage${active !== null ? ' is-shifted' : ''}`}>
      <div className="flow-menu" role="list" aria-label="4 kỹ năng VSTEP">
        {SKILLS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="listitem"
            className={`flow-row${active === i ? ' is-active' : ''}`}
            aria-expanded={active === i}
            onClick={() => setActive(active === i ? null : i)}
          >
            <span className="flow-idx">{s.no}</span>
            <span className="flow-name">{s.short}</span>
            <span className="flow-count">{s.count}</span>
            <Marquee text={`${s.short} — ${s.count}`} />
          </button>
        ))}
      </div>
      <div className="flow-panel" aria-hidden={active === null}>
        {active !== null && (
          <SkillPanel skill={SKILLS[active]} onClose={() => setActive(null)} />
        )}
      </div>
    </div>
  );
}
