'use client';

// ShimmerButton — adapted from the Magic UI Shimmer Button component,
// converted to TypeScript + vanilla CSS (this project does not use Tailwind).
// A shimmering beam of light travels around the button's perimeter.

import React, { type ComponentPropsWithoutRef, type CSSProperties } from 'react';

import './shimmer-button.css';

export interface ShimmerButtonProps extends ComponentPropsWithoutRef<'button'> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
}

function cn(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(' ');
}

export const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = '#ffffff',
      shimmerSize = '0.05em',
      shimmerDuration = '3s',
      borderRadius = '100px',
      background = 'rgba(0, 0, 0, 1)',
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        style={
          {
            '--spread': '90deg',
            '--shimmer-color': shimmerColor,
            '--radius': borderRadius,
            '--speed': shimmerDuration,
            '--cut': shimmerSize,
            '--bg': background,
          } as CSSProperties
        }
        className={cn('shimmer-btn', className)}
        ref={ref}
        {...props}
      >
        <span className="shimmer-spark-container" aria-hidden="true">
          <span className="shimmer-spark">
            <span className="shimmer-spin" />
          </span>
        </span>
        <span className="shimmer-content">{children}</span>
        <span className="shimmer-highlight" aria-hidden="true" />
        <span className="shimmer-backdrop" aria-hidden="true" />
      </button>
    );
  }
);

ShimmerButton.displayName = 'ShimmerButton';
