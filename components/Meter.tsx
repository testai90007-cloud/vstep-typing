'use client';

// Meter — thin metric readout in the spirit of COSS UI's Meter
// (https://coss.com/ui/docs/components/meter): label + value on one row,
// hairline track with an animated indicator below. The site's understated
// answer to gauge-style metrics. Pure CSS indicator (width transition),
// zero JS deps.

import type { ReactNode } from 'react';
import './Meter.css';

interface MeterProps {
  label: string;
  value: ReactNode;
  /** 0–100 */
  percent: number;
  tone?: 'accent' | 'danger';
  ariaLabel?: string;
}

export function Meter({
  label,
  value,
  percent,
  tone = 'accent',
  ariaLabel,
}: MeterProps) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="meter"
      role="meter"
      aria-label={ariaLabel ?? label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className="meter-head">
        <span className="meter-label">{label}</span>
        <span className="meter-value">{value}</span>
      </div>
      <div className="meter-track">
        <div
          className={`meter-fill ${tone}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
