'use client';

// TEMPORARY QA preview — DELETE before production deploy.

import { useState } from 'react';
import { SmoothTab } from '@/components/SmoothTab';
import { StepIndicator } from '@/components/StepIndicator';
import { Meter } from '@/components/Meter';
import { HoldPeekButton } from '@/components/HoldPeekButton';
import { AnimCheckbox } from '@/components/AnimCheckbox';
import CountUp from '@/components/CountUp';
import { LightBulbIcon } from '@heroicons/react/24/outline';

export default function PreviewTypingUI() {
  const [scope, setScope] = useState('whole');
  const [revealed, setRevealed] = useState(false);
  return (
    <main className="page" style={{ display: 'grid', gap: 28 }}>
      <p style={{ color: 'var(--faint)', fontSize: '0.8rem' }}>
        QA preview (mock) — xóa trước khi deploy production.
      </p>

      <section>
        <h3>1. SmoothTab — Phạm vi</h3>
        <SmoothTab
          ariaLabel="Chọn phạm vi luyện"
          activeId={scope}
          onChange={setScope}
          tabs={[
            { id: 'whole', label: 'Toàn bài' },
            { id: 'sections', label: 'Từng phần' },
          ]}
        />
      </section>

      <section>
        <h3>2. StepIndicator — Cấu trúc bài</h3>
        <StepIndicator
          ariaLabel="Cấu trúc bài theo đoạn"
          onStepClick={() => {}}
          steps={[
            { label: 'Mở bài', state: 'complete' },
            { label: 'Quan điểm 1', state: 'complete' },
            { label: 'Quan điểm 2', state: 'active' },
            { label: 'Kết luận', state: 'todo' },
          ]}
        />
      </section>

      <section>
        <h3>3. Meter — metrics</h3>
        <div className="metric-grid" style={{ marginTop: 0 }}>
          <div className="metric-meter">
            <Meter label="Độ chính xác" value="87%" percent={87} />
          </div>
          <div className="metric-meter">
            <Meter label="Tiến độ" value={<><CountUp to={42} />%</>} percent={42} />
          </div>
          <div className="metric-meter">
            <Meter label="Đếm ngược toàn bài" value="07:12" percent={90} tone="danger" />
          </div>
        </div>
      </section>

      <section>
        <h3>4. HoldPeekButton — nhấn giữ để xem</h3>
        <HoldPeekButton
          ariaLabel="Nhấn giữ để xem gợi ý"
          onDown={() => setRevealed(true)}
          onUp={() => setRevealed(false)}
        >
          <LightBulbIcon width={16} height={16} />
          Nhấn giữ để xem gợi ý
        </HoldPeekButton>
        <p style={{ color: revealed ? 'var(--ink)' : 'var(--faint)' }}>
          {revealed ? '👀 Đang hiện gợi ý (giữ chuột)' : 'Gợi ý đang ẩn'}
        </p>
      </section>

      <section>
        <h3>5. AnimCheckbox — drill progress</h3>
        <div className="drill-progress">
          {['dilemma', 'phenomenon', 'controversial', 'perspective'].map((w, i) => (
            <AnimCheckbox key={w} title={w} small checked={i < 2} />
          ))}
        </div>
      </section>
    </main>
  );
}
