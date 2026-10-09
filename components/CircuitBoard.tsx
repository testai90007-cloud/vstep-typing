'use client';

// CircuitBoard — adapted from the Cult UI circuit-board component
// (https://www.cult-ui.com/docs/components/circuit-board, MIT licensed).
// Animated SVG circuit traces with traveling pulses converging on a central
// chip, wired to 3 cards below. Converted to TypeScript + vanilla CSS,
// theme-aware via the site's CSS variables. The 3 cards are the homepage
// utilities (Tiến độ học tập / Hồ sơ năng lực / Cài đặt AI) with internal
// Next.js links and heroicons instead of the original React/Turbopack/SWC
// external cards. Pulse colors (blue→pink→orange) match the site's gradient
// accent. SVG SMIL animations (animateMotion / animateTransform) are kept
// as-is — no JS animation loop needed.

import { useId } from 'react';
import Link from 'next/link';
import { motion, type Variants } from 'motion/react';
import {
  ArrowUpRightIcon,
  ChartBarIcon,
  IdentificationIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import './CircuitBoard.css';

const spring = { type: 'spring' as const, stiffness: 300, damping: 24 };

const cardStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const cardFadeUp: Variants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: spring,
  },
};

const MotionLink = motion(Link);

interface UtilCard {
  name: string;
  href: string;
  desc: string;
  Icon: typeof ChartBarIcon;
  glowColor: string;
  glowDelay: number;
}

const UTILS: UtilCard[] = [
  {
    name: 'Tiến độ học tập',
    href: '/progress',
    desc: 'Chuỗi ngày học liên tiếp, thống kê từng kỹ năng và lịch sử chi tiết.',
    Icon: ChartBarIcon,
    glowColor: 'rgba(0, 180, 216, 0.15)',
    glowDelay: 0,
  },
  {
    name: 'Hồ sơ năng lực',
    href: '/ho-so-nang-luc',
    desc: 'Điểm trung bình từng kỹ năng đặt cạnh ngưỡng mục tiêu B1/B2/C1 của bạn.',
    Icon: IdentificationIcon,
    glowColor: 'rgba(139, 92, 246, 0.15)',
    glowDelay: 0.8,
  },
  {
    name: 'Cài đặt AI',
    href: '/settings',
    desc: 'Thêm API key của riêng bạn (Gemini miễn phí) để AI chấm bài.',
    Icon: Cog6ToothIcon,
    glowColor: 'rgba(255, 135, 0, 0.15)',
    glowDelay: 1.6,
  },
];

export default function CircuitBoard() {
  const id = useId();

  return (
    <div className="cb">
      <div className="cb-board">
        <svg
          aria-label="Mạch điện nối vào chip Tiện ích"
          className="cb-svg"
          fill="none"
          height="264"
          role="img"
          viewBox="0 0 891 264"
          width="891"
        >
          <defs>
            {/* Orange Pulse Gradients */}
            <linearGradient id={`${id}-orange-pulse-1`} x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(255, 135, 0, 0)" />
              <stop offset="50%" stopColor="rgba(255, 135, 0, 1)" />
              <stop offset="100%" stopColor="rgba(255, 135, 0, 0)" />
              <animateTransform
                attributeName="gradientTransform"
                dur="2s"
                from="-1 0"
                repeatCount="indefinite"
                to="1 0"
                type="translate"
              />
            </linearGradient>

            <linearGradient id={`${id}-orange-pulse-2`} x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(255, 135, 0, 0)" />
              <stop offset="50%" stopColor="rgba(255, 135, 0, 1)" />
              <stop offset="100%" stopColor="rgba(255, 135, 0, 0)" />
              <animateTransform
                attributeName="gradientTransform"
                dur="2.5s"
                from="-1 0"
                repeatCount="indefinite"
                to="1 0"
                type="translate"
              />
            </linearGradient>

            {/* Blue Pulse Gradients */}
            <linearGradient id={`${id}-blue-pulse-1`} x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(0, 180, 216, 0)" />
              <stop offset="50%" stopColor="rgba(0, 180, 216, 1)" />
              <stop offset="100%" stopColor="rgba(0, 180, 216, 0)" />
              <animateTransform
                attributeName="gradientTransform"
                dur="2s"
                from="-1 0"
                repeatCount="indefinite"
                to="1 0"
                type="translate"
              />
            </linearGradient>

            <linearGradient id={`${id}-blue-pulse-2`} x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(0, 180, 216, 0)" />
              <stop offset="50%" stopColor="rgba(0, 180, 216, 1)" />
              <stop offset="100%" stopColor="rgba(0, 180, 216, 0)" />
              <animateTransform
                attributeName="gradientTransform"
                dur="1.8s"
                from="-1 0"
                repeatCount="indefinite"
                to="1 0"
                type="translate"
              />
            </linearGradient>

            {/* Pink Pulse Gradient */}
            <linearGradient id={`${id}-pink-pulse`} x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 0, 128, 0)" />
              <stop offset="50%" stopColor="rgba(255, 0, 128, 1)" />
              <stop offset="100%" stopColor="rgba(255, 0, 128, 0)" />
              <animateTransform
                attributeName="gradientTransform"
                dur="2s"
                from="0 -1"
                repeatCount="indefinite"
                to="0 1"
                type="translate"
              />
            </linearGradient>

            {/* Connector pulse gradients (vertical direction) */}
            <linearGradient id={`${id}-blue-conn`} x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(0, 180, 216, 0)" />
              <stop offset="50%" stopColor="rgba(0, 180, 216, 0.8)" />
              <stop offset="100%" stopColor="rgba(0, 180, 216, 0)" />
              <animateTransform
                attributeName="gradientTransform"
                dur="2s"
                from="0 -1"
                repeatCount="indefinite"
                to="0 1"
                type="translate"
              />
            </linearGradient>
            <linearGradient id={`${id}-orange-conn`} x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 135, 0, 0)" />
              <stop offset="50%" stopColor="rgba(255, 135, 0, 0.8)" />
              <stop offset="100%" stopColor="rgba(255, 135, 0, 0)" />
              <animateTransform
                attributeName="gradientTransform"
                dur="2s"
                from="0 -1"
                repeatCount="indefinite"
                to="0 1"
                type="translate"
              />
            </linearGradient>
            <linearGradient id={`${id}-mixed-conn`} x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(180, 120, 255, 0)" />
              <stop offset="50%" stopColor="rgba(180, 120, 255, 0.6)" />
              <stop offset="100%" stopColor="rgba(180, 120, 255, 0)" />
              <animateTransform
                attributeName="gradientTransform"
                dur="2.2s"
                from="0 -1"
                repeatCount="indefinite"
                to="0 1"
                type="translate"
              />
            </linearGradient>

            {/* Chip ambient halo */}
            <radialGradient id={`${id}-halo`}>
              <stop offset="0%" stopColor="rgba(255, 135, 0, 0.05)" />
              <stop offset="40%" stopColor="rgba(0, 180, 216, 0.025)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          {/* Static background lines */}
          <g className="cb-static" strokeLinecap="round">
            <path d="M388 96L388 68C388 65.7909 386.209 64 384 64L310 64" />
            <path d="M349 150L73 150C70.7909 150 69 151.791 69 154L69 174" />
            <path d="M574 96L574 4C574 1.79086 575.791 0 578 0L751 0" />
            <path d="M506 96L506 62C506 59.7909 507.791 58 510 58L579 58" />
            <path d="M388 96L388 44C388 41.7909 389.791 40 392 40L509 40C511.209 40 513 38.2091 513 36L513 0" />
            <path d="M547 110L822 110C824.209 110 826 108.209 826 106L826 0" />
            <path d="M349 110L67 110C64.7909 110 63 108.209 63 106L63 0" />
            <path d="M547 150L697 150C699.209 150 701 148.209 701 146L701 0" />
            <path d="M349 150L199 150C196.791 150 195 148.209 195 146L195 0" />
          </g>

          {/* Endpoint dots on visible static path terminals */}
          <g className="cb-dot">
            <circle cx="310" cy="64" r="2.5" />
            <circle cx="69" cy="174" r="2.5" />
            <circle cx="579" cy="58" r="2.5" />
          </g>

          {/* Orange animated line - right side */}
          <g>
            <path
              className="cb-static"
              d="M547 130L822 130C824.209 130 826 131.791 826 134L826 264"
              strokeLinecap="round"
            />
            <path
              d="M547 130L822 130C824.209 130 826 131.791 826 134L826 264"
              opacity="0.3"
              stroke={`url(#${id}-orange-pulse-1)`}
              strokeWidth="6"
            />
            <path
              d="M547 130L822 130C824.209 130 826 131.791 826 134L826 264"
              stroke={`url(#${id}-orange-pulse-1)`}
              strokeWidth="2"
            />
            <circle fill="#ff8700" r="2.5">
              <animateMotion
                dur="3s"
                path="M547 130L822 130C824.209 130 826 131.791 826 134L826 264"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                dur="3s"
                keyTimes="0;0.1;0.9;1"
                repeatCount="indefinite"
                values="0;0.9;0.9;0"
              />
            </circle>
          </g>

          {/* Blue animated line - left side */}
          <g>
            <path
              className="cb-static"
              d="M349 130L5.00002 130C2.79088 130 1.00001 131.791 1.00001 134L1.00001 264"
              strokeLinecap="round"
            />
            <path
              d="M349 130L5.00002 130C2.79088 130 1.00001 131.791 1.00001 134L1.00001 264"
              opacity="0.3"
              stroke={`url(#${id}-blue-pulse-1)`}
              strokeLinecap="round"
              strokeWidth="6"
            />
            <path
              d="M349 130L5.00002 130C2.79088 130 1.00001 131.791 1.00001 134L1.00001 264"
              stroke={`url(#${id}-blue-pulse-1)`}
              strokeLinecap="round"
              strokeWidth="2"
            />
            <circle fill="#00b4d8" r="2.5">
              <animateMotion
                dur="3.5s"
                path="M349 130L5.00002 130C2.79088 130 1.00001 131.791 1.00001 134L1.00001 264"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                dur="3.5s"
                keyTimes="0;0.1;0.9;1"
                repeatCount="indefinite"
                values="0;0.9;0.9;0"
              />
            </circle>
          </g>

          {/* Orange animated line - center right */}
          <g>
            <path
              className="cb-static"
              d="M547 150L633 150C635.209 150 637 151.791 637 154L637 236C637 238.209 635.209 240 633 240L488 240C485.791 240 484 241.791 484 244L484 264"
              strokeLinecap="round"
            />
            <path
              d="M547 150L633 150C635.209 150 637 151.791 637 154L637 236C637 238.209 635.209 240 633 240L488 240C485.791 240 484 241.791 484 244L484 264"
              opacity="0.3"
              stroke={`url(#${id}-orange-pulse-2)`}
              strokeWidth="6"
            />
            <path
              d="M547 150L633 150C635.209 150 637 151.791 637 154L637 236C637 238.209 635.209 240 633 240L488 240C485.791 240 484 241.791 484 244L484 264"
              stroke={`url(#${id}-orange-pulse-2)`}
              strokeWidth="2"
            />
          </g>

          {/* Blue animated line - center left */}
          <g>
            <path
              className="cb-static"
              d="M349 150L261 150C258.791 150 257 151.791 257 154L257 236C257 238.209 258.791 240 261 240L406 240C408.209 240 410 241.791 410 244L410 264"
              strokeLinecap="round"
            />
            <path
              d="M349 150L261 150C258.791 150 257 151.791 257 154L257 236C257 238.209 258.791 240 261 240L406 240C408.209 240 410 241.791 410 244L410 264"
              opacity="0.3"
              stroke={`url(#${id}-blue-pulse-2)`}
              strokeLinecap="round"
              strokeWidth="6"
            />
            <path
              d="M349 150L261 150C258.791 150 257 151.791 257 154L257 236C257 238.209 258.791 240 261 240L406 240C408.209 240 410 241.791 410 244L410 264"
              stroke={`url(#${id}-blue-pulse-2)`}
              strokeLinecap="round"
              strokeWidth="2"
            />
          </g>

          {/* Pink animated line - top */}
          <g>
            <path className="cb-static" d="M506 96L506 0" strokeLinecap="round" />
            <path
              d="M506 96L506 0"
              opacity="0.3"
              stroke={`url(#${id}-pink-pulse)`}
              strokeLinecap="round"
              strokeWidth="6"
            />
            <path
              d="M506 96L506 0"
              stroke={`url(#${id}-pink-pulse)`}
              strokeLinecap="round"
              strokeWidth="2"
            />
            <circle fill="#ff0080" r="2">
              <animateMotion dur="2.5s" path="M506 96L506 0" repeatCount="indefinite" />
              <animate
                attributeName="opacity"
                dur="2.5s"
                keyTimes="0;0.1;0.9;1"
                repeatCount="indefinite"
                values="0;0.9;0.9;0"
              />
            </circle>
          </g>

          {/* Chip ambient halo */}
          <ellipse cx="448" cy="136" fill={`url(#${id}-halo)`} rx="180" ry="90" />

          {/* Junction nodes at chip connection points */}
          <g>
            <circle cx="547" cy="130" r="2.5" fill="#ff8700" fillOpacity="0.6">
              <animate attributeName="opacity" dur="2s" repeatCount="indefinite" values="0.4;1;0.4" />
            </circle>
            <circle cx="349" cy="130" r="2.5" fill="#00b4d8" fillOpacity="0.6">
              <animate attributeName="opacity" dur="2.2s" repeatCount="indefinite" values="0.4;1;0.4" />
            </circle>
            <circle cx="547" cy="150" r="2" fill="#ff8700" fillOpacity="0.4">
              <animate attributeName="opacity" dur="2.5s" repeatCount="indefinite" values="0.3;0.8;0.3" />
            </circle>
            <circle cx="349" cy="150" r="2" fill="#00b4d8" fillOpacity="0.4">
              <animate attributeName="opacity" dur="2.3s" repeatCount="indefinite" values="0.3;0.8;0.3" />
            </circle>
            <circle cx="506" cy="96" r="2.5" fill="#ff0080" fillOpacity="0.6">
              <animate attributeName="opacity" dur="2s" repeatCount="indefinite" values="0.4;1;0.4" />
            </circle>
          </g>

          {/* Connector paths: traces -> card columns */}
          {/* Blue left -> Card 1 */}
          <g>
            <path className="cb-static" d="M1 264 C1 290 60 320 148 320" strokeLinecap="round" />
            <path
              d="M1 264 C1 290 60 320 148 320"
              opacity="0.2"
              stroke={`url(#${id}-blue-conn)`}
              strokeLinecap="round"
              strokeWidth="5"
            />
            <path
              d="M1 264 C1 290 60 320 148 320"
              stroke={`url(#${id}-blue-conn)`}
              strokeLinecap="round"
              strokeWidth="1.5"
            />
            <circle className="cb-dot" cx="148" cy="320" r="2.5" />
          </g>

          {/* Mixed center -> Card 2 */}
          <g>
            <path className="cb-static" d="M410 264 C410 290 430 320 445 320" strokeLinecap="round" />
            <path
              d="M410 264 C410 290 430 320 445 320"
              opacity="0.2"
              stroke={`url(#${id}-mixed-conn)`}
              strokeLinecap="round"
              strokeWidth="5"
            />
            <path
              d="M410 264 C410 290 430 320 445 320"
              stroke={`url(#${id}-mixed-conn)`}
              strokeLinecap="round"
              strokeWidth="1.5"
            />
          </g>
          <g>
            <path className="cb-static" d="M484 264 C484 290 462 320 445 320" strokeLinecap="round" />
            <path
              d="M484 264 C484 290 462 320 445 320"
              opacity="0.2"
              stroke={`url(#${id}-mixed-conn)`}
              strokeLinecap="round"
              strokeWidth="5"
            />
            <path
              d="M484 264 C484 290 462 320 445 320"
              stroke={`url(#${id}-mixed-conn)`}
              strokeLinecap="round"
              strokeWidth="1.5"
            />
            <circle className="cb-dot" cx="445" cy="320" r="2.5" />
          </g>

          {/* Orange right -> Card 3 */}
          <g>
            <path className="cb-static" d="M826 264 C826 290 800 320 748 320" strokeLinecap="round" />
            <path
              d="M826 264 C826 290 800 320 748 320"
              opacity="0.2"
              stroke={`url(#${id}-orange-conn)`}
              strokeLinecap="round"
              strokeWidth="5"
            />
            <path
              d="M826 264 C826 290 800 320 748 320"
              stroke={`url(#${id}-orange-conn)`}
              strokeLinecap="round"
              strokeWidth="1.5"
            />
            <circle className="cb-dot" cx="748" cy="320" r="2.5" />
          </g>
        </svg>

        {/* HTML CPU Chip overlay */}
        <div aria-hidden="true" className="cb-chip">
          <div className="cb-chip-stack">
            {/* Top connectors */}
            <div className="cb-pins-row">
              {Array.from({ length: 6 }).map((_, i) => (
                <span className="cb-pin cb-pin-h" key={`t-${i}`} />
              ))}
            </div>

            <div className="cb-chip-middle">
              {/* Left connectors */}
              <div className="cb-pins-col">
                {Array.from({ length: 2 }).map((_, i) => (
                  <span className="cb-pin cb-pin-v" key={`l-${i}`} />
                ))}
              </div>

              {/* Chip body */}
              <div className="cb-chip-body">
                <div className="cb-chip-shine" />
                <span className="cb-chip-label">Tiện ích</span>
              </div>

              {/* Right connectors */}
              <div className="cb-pins-col">
                {Array.from({ length: 2 }).map((_, i) => (
                  <span className="cb-pin cb-pin-v" key={`r-${i}`} />
                ))}
              </div>
            </div>

            {/* Bottom connectors */}
            <div className="cb-pins-row">
              {Array.from({ length: 6 }).map((_, i) => (
                <span className="cb-pin cb-pin-h" key={`b-${i}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Utility cards */}
      <motion.div
        animate="visible"
        className="cb-cards"
        initial="hidden"
        variants={cardStagger}
      >
        {UTILS.map((u) => (
          <UtilCard key={u.href} {...u} />
        ))}
      </motion.div>
    </div>
  );
}

function UtilCard({ name, href, desc, Icon, glowColor, glowDelay }: UtilCard) {
  return (
    <MotionLink className="cb-card" href={href} variants={cardFadeUp}>
      {/* Glow overlay */}
      <div
        aria-hidden="true"
        className="cb-glow"
        style={{
          boxShadow: `0 0 24px 4px ${glowColor}, inset 0 0 16px 1px ${glowColor}`,
          animation: `pulse-glow 4s ease-in-out ${glowDelay}s infinite`,
        }}
      />
      {/* Top accent line */}
      <div
        aria-hidden="true"
        className="cb-accent"
        style={{
          background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)`,
          animation: `pulse-glow 4s ease-in-out ${glowDelay}s infinite`,
        }}
      />
      <div className="cb-card-icon">
        <Icon width={24} height={24} strokeWidth={1.8} />
      </div>
      <h3 className="cb-card-title">
        {name}
        <ArrowUpRightIcon className="cb-card-arrow" width={16} height={16} />
      </h3>
      <p className="cb-card-desc">{desc}</p>
    </MotionLink>
  );
}
