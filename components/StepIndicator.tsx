'use client';

// StepIndicator — the indicator strip of React Bits' Stepper
// (https://reactbits.dev/components/stepper), without its wizard chrome.
// Original mechanics kept: numbered circles, connectors whose fill animates
// 0 → 100% when the preceding step completes, check icon on completed steps,
// active step highlighted, click-to-jump via onStepChange.
// Converted to TypeScript + vanilla CSS; accent follows the site theme.

import { Fragment } from 'react';
import { motion } from 'motion/react';
import { CheckIcon } from '@heroicons/react/24/outline';
import './StepIndicator.css';

export type StepState = 'complete' | 'active' | 'todo';

export interface StepDef {
  label: string;
  state: StepState;
}

interface StepIndicatorProps {
  steps: StepDef[];
  onStepClick?: (index: number) => void;
  clickable?: boolean;
  ariaLabel?: string;
}

export function StepIndicator({
  steps,
  onStepClick,
  clickable = true,
  ariaLabel = 'Các bước',
}: StepIndicatorProps) {
  return (
    <div className="step-ind" role="list" aria-label={ariaLabel}>
      {steps.map((s, i) => (
        <Fragment key={i}>
          <button
            type="button"
            role="listitem"
            className={`step-node ${s.state}`}
            disabled={!clickable}
            aria-current={s.state === 'active' ? 'step' : undefined}
            aria-label={`Đoạn ${i + 1}: ${s.label}${
              s.state === 'complete' ? ' (đã xong)' : ''
            }`}
            onClick={() => onStepClick?.(i)}
          >
            <span className="step-circle">
              {s.state === 'complete' ? (
                <CheckIcon width={15} height={15} strokeWidth={2.5} />
              ) : (
                <span className="step-num">{i + 1}</span>
              )}
            </span>
            <span className="step-name">{s.label}</span>
          </button>
          {i < steps.length - 1 && (
            <span className="step-conn" aria-hidden="true">
              <motion.span
                className="step-conn-fill"
                initial={false}
                animate={s.state === 'complete' ? 'complete' : 'incomplete'}
                variants={{
                  incomplete: { scaleX: 0 },
                  complete: { scaleX: 1 },
                }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
            </span>
          )}
        </Fragment>
      ))}
    </div>
  );
}
