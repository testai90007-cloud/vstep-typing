'use client';

// VoicePill — adapted from the React Bits VoicePill component
// (https://reactbits.dev/components/voice-pill), converted to TypeScript.
// A mic button that opens into a capsule with elapsed clock + live waveform
// while held/listening, with slide-to-cancel. `reactive="mic"` drives the
// waveform from the real microphone (asks permission on first press).

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type KeyboardEvent as RKeyboardEvent, type MouseEvent as RMouseEvent } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, Mic01Icon } from '@hugeicons/core-free-icons';
import './VoicePill.css';

const LOOP = 4.8;
const SYLLABLES: Array<[number, number, number]> = [
  [0.1, 0.16, 0.9],
  [0.3, 0.12, 0.7],
  [0.5, 0.2, 1],
  [0.95, 0.14, 0.8],
  [1.15, 0.1, 0.6],
  [1.3, 0.22, 0.95],
  [1.9, 0.16, 0.85],
  [2.12, 0.12, 0.7],
  [2.3, 0.18, 0.9],
  [2.55, 0.1, 0.5],
  [3.05, 0.24, 1],
  [3.4, 0.12, 0.75],
  [3.6, 0.16, 0.9],
];
const MIC_BINS: Array<[number, number]> = [
  [1, 4],
  [4, 11],
  [11, 33],
];
const MIC_GAIN = 2.2;
const DT_MAX = 0.05;
const SLIDE_MIN = 4;
const WAVE_EVERY = 4;
const WAVE_MAX = 80;

interface AudioState {
  ctx: AudioContext;
  stream?: MediaStream | null;
  /** true when `stream` is owned by the parent — never stop its tracks */
  external?: boolean;
  src?: MediaStreamAudioSourceNode | null;
  analyser?: AnalyserNode | null;
  buf?: Uint8Array<ArrayBuffer> | null;
}

interface PillState {
  listening: boolean;
  pointerId: number | null;
  ownPress: boolean;
  downX: number;
  sliding: boolean;
  hist: number[];
  tick: number;
  acc: number;
  downAt: number;
  startedAt: number;
  raf: number;
  last: number;
  env: number;
  t0: number;
  audio: AudioState | null;
}

const simulatedLevel = (t: number): number => {
  const u = t % LOOP;
  let a = 0.06;
  for (const [s, d, p] of SYLLABLES) {
    const x = (u - s) / d;
    if (x >= 0 && x <= 1) a = Math.max(a, p * 0.5 * (1 - Math.cos(2 * Math.PI * x)));
  }
  return a * (0.7 + 0.3 * Math.abs(Math.sin(2 * Math.PI * 7.1 * u)));
};

const micLevel = (analyser: AnalyserNode, buf: Uint8Array<ArrayBuffer>): number => {
  analyser.getByteFrequencyData(buf);
  let total = 0;
  for (const [lo, hi] of MIC_BINS) {
    let s = 0;
    for (let i = lo; i < hi; i += 1) s += buf[i];
    total += s / ((hi - lo) * 255);
  }
  return (total / MIC_BINS.length) * MIC_GAIN;
};

const drawWave = (s: PillState, canvas: HTMLCanvasElement, level: number, color: string, floor: number) => {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const W = Math.max(1, Math.round(rect.width * dpr));
  const H = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  s.acc = Math.max(s.acc, level);
  s.tick = (s.tick + 1) % WAVE_EVERY;
  if (s.tick === 0) {
    s.hist.push(s.acc);
    s.acc = 0;
    if (s.hist.length > WAVE_MAX) s.hist.shift();
  }
  const bw = 2 * dpr;
  const step = 3 * dpr;
  const shift = (s.tick / WAVE_EVERY) * step;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = color;
  for (let i = 0; i < s.hist.length; i += 1) {
    const v = s.hist[s.hist.length - 1 - i];
    const x = W - (i + 1) * step - shift;
    if (x + bw < 0) break;
    const h = Math.max(bw, (floor + (1 - floor) * v) * H);
    const t = Math.min(1, Math.max(0, (x + bw / 2) / (W * 0.55)));
    const fade = t * t * (3 - 2 * t);
    ctx.globalAlpha = (0.35 + 0.65 * v) * fade;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, (H - h) / 2, bw, h, bw / 2);
    } else {
      ctx.rect(x, (H - h) / 2, bw, h);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

const clock = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Attach an analyser to a stream (own or parent-shared). */
const attachStream = (s: PillState, stream: MediaStream, external: boolean): void => {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  if (!s.audio) s.audio = { ctx: new Ctx() };
  const a = s.audio;
  if (a.ctx.state === 'suspended') void a.ctx.resume();
  a.src?.disconnect();
  a.stream = stream;
  a.external = external;
  a.src = a.ctx.createMediaStreamSource(stream);
  a.analyser = a.ctx.createAnalyser();
  a.analyser.fftSize = 256;
  a.analyser.smoothingTimeConstant = 0;
  a.src.connect(a.analyser);
  a.buf = new Uint8Array(a.analyser.frequencyBinCount);
};

const openMic = async (s: PillState): Promise<void> => {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  if (!s.listening) {
    stream.getTracks().forEach((t) => t.stop());
    return;
  }
  attachStream(s, stream, false);
};

const closeMic = (s: PillState): void => {
  const a = s.audio;
  if (!a?.stream) return;
  // Never stop a parent-owned stream's tracks — the parent owns its lifecycle.
  if (!a.external) a.stream.getTracks().forEach((t) => t.stop());
  a.src?.disconnect();
  a.stream = null;
  a.external = false;
  a.src = null;
  a.analyser = null;
  a.buf = null;
};

export interface VoicePillProps {
  accentColor?: string;
  iconColor?: string;
  background?: string;
  size?: number;
  shape?: 'pill' | 'rounded';
  reach?: number;
  showTime?: boolean;
  waveform?: boolean;
  slideToCancel?: boolean;
  cancelDistance?: number;
  attack?: number;
  release?: number;
  sensitivity?: number;
  floor?: number;
  openDuration?: number;
  pressScale?: number;
  mode?: 'auto' | 'hold' | 'toggle';
  holdAfter?: number;
  reactive?: 'simulated' | 'mic';
  disabled?: boolean;
  ariaLabel?: string;
  onStart?: (info: { source: string }) => void;
  onStop?: (info: { reason: string; duration: number }) => void;
  className?: string;
  /**
   * Increment to programmatically begin listening (e.g. exam auto-start).
   * The pill begins on mount/change when this is truthy and changing.
   */
  autoBeginSignal?: number;
  /**
   * Stream owned by the parent (e.g. the MediaRecorder's stream). When
   * provided with `useExternalStream`, the pill uses it for the waveform
   * analyser and never opens its own getUserMedia — one mic stream total.
   */
  externalStream?: MediaStream | null;
  /** When true, never open a mic stream of our own; wait for externalStream. */
  useExternalStream?: boolean;
}

export default function VoicePill({
  accentColor = '#f5f5f5',
  iconColor = '#a1a1aa',
  background = '#27272a',
  size = 28,
  shape = 'pill',
  reach = 8,
  showTime = true,
  waveform = true,
  slideToCancel = true,
  cancelDistance = 64,
  attack = 40,
  release = 240,
  sensitivity = 1,
  floor = 0.1,
  openDuration = 200,
  pressScale = 0.95,
  mode = 'auto',
  holdAfter = 300,
  reactive = 'simulated',
  disabled = false,
  ariaLabel = 'Dictate',
  onStart,
  onStop,
  className = '',
  autoBeginSignal = 0,
  externalStream = null,
  useExternalStream = false,
}: VoicePillProps) {
  const [listening, setListening] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [input, setInput] = useState('pointer');
  const timeRef = useRef<HTMLSpanElement | null>(null);
  const rootRef = useRef<HTMLButtonElement | null>(null);
  const waveRef = useRef<HTMLCanvasElement | null>(null);
  const st = useRef<PillState>({
    listening: false,
    pointerId: null,
    ownPress: false,
    downX: 0,
    sliding: false,
    hist: [],
    tick: 0,
    acc: 0,
    downAt: 0,
    startedAt: 0,
    raf: 0,
    last: 0,
    env: 0,
    t0: 0,
    audio: null,
  });
  const cfg = useRef({
    attack,
    release,
    sensitivity,
    floor,
    mode,
    holdAfter,
    reactive,
    showTime,
    waveform,
    slideToCancel,
    cancelDistance,
    accentColor,
    onStart,
    onStop,
    useExternalStream,
  });
  cfg.current = {
    attack,
    release,
    sensitivity,
    floor,
    mode,
    holdAfter,
    reactive,
    showTime,
    waveform,
    slideToCancel,
    cancelDistance,
    accentColor,
    onStart,
    onStop,
    useExternalStream,
  };

  const frame = (now: number): void => {
    const s = st.current;
    const c = cfg.current;
    const dt = Math.min((now - s.last) / 1000, DT_MAX);
    s.last = now;
    let target = 0;
    if (s.listening) {
      if (s.audio?.analyser && s.audio.buf) target = micLevel(s.audio.analyser, s.audio.buf);
      else if (c.reactive !== 'mic') target = simulatedLevel((now - s.t0) / 1000);
    }
    target = Math.min(1, target * c.sensitivity);
    const tau = Math.max(1, target > s.env ? c.attack : c.release) / 1000;
    s.env += (target - s.env) * (1 - Math.exp(-dt / tau));
    if (s.listening && c.showTime && timeRef.current) {
      const text = clock(now - s.startedAt);
      if (timeRef.current.textContent !== text) timeRef.current.textContent = text;
    }
    if (s.listening && c.waveform && waveRef.current) drawWave(s, waveRef.current, s.env, c.accentColor, c.floor);
    s.raf = s.listening ? requestAnimationFrame(frame) : 0;
  };

  const begin = (kind: string): void => {
    const s = st.current;
    const c = cfg.current;
    if (s.listening || disabled) return;
    s.listening = true;
    s.hist = [];
    s.tick = 0;
    s.acc = 0;
    s.env = 0;
    s.startedAt = performance.now();
    s.t0 = s.startedAt;
    s.last = s.startedAt;
    if (timeRef.current) timeRef.current.textContent = '0:00';
    setListening(true);
    setInput(kind);
    if (!s.raf) s.raf = requestAnimationFrame(frame);
    c.onStart?.({ source: c.reactive });
    // In shared-stream mode the parent supplies the mic stream (see the
    // externalStream effect below) — never open a second one of our own.
    if (c.reactive === 'mic' && !c.useExternalStream) openMic(s).catch(() => end('mic-denied'));
  };

  const end = (reason: string): void => {
    const s = st.current;
    const c = cfg.current;
    if (!s.listening) return;
    s.listening = false;
    closeMic(s);
    setListening(false);
    setInput(reason === 'key' || reason === 'escape' ? 'key' : 'pointer');
    c.onStop?.({ reason, duration: Math.round(performance.now() - s.startedAt) });
  };

  const settleSlide = (): void => {
    const s = st.current;
    const root = rootRef.current;
    s.sliding = false;
    if (!root) return;
    delete root.dataset.sliding;
    root.style.setProperty('--vp-slide', '0px');
    root.style.setProperty('--vp-cancel', '0');
  };

  const onPointerMove = (e: RPointerEvent<HTMLButtonElement>): void => {
    const s = st.current;
    const c = cfg.current;
    const root = rootRef.current;
    if (!root || s.pointerId !== e.pointerId || !c.slideToCancel || !s.listening || !s.ownPress) return;
    const dx = e.clientX - s.downX;
    if (!s.sliding && dx > -SLIDE_MIN) return;
    s.sliding = true;
    root.dataset.sliding = '';
    const pull = Math.min(c.cancelDistance + 24, Math.max(0, -dx));
    root.style.setProperty('--vp-slide', `${-pull}px`);
    const progress = Math.min(1, pull / c.cancelDistance);
    root.style.setProperty('--vp-cancel', progress.toFixed(3));
    if (progress >= 1) {
      settleSlide();
      end('cancel');
    }
  };

  const onPointerDown = (e: RPointerEvent<HTMLButtonElement>): void => {
    const s = st.current;
    if (disabled || e.button !== 0 || !e.isPrimary || s.pointerId !== null) return;
    s.pointerId = e.pointerId;
    s.downX = e.clientX;
    s.downAt = performance.now();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setPressed(true);
    s.ownPress = !s.listening;
    if (!s.listening) begin('pointer');
  };

  const onPointerUp = (e: RPointerEvent<HTMLButtonElement>): void => {
    const s = st.current;
    const c = cfg.current;
    if (e.pointerId !== s.pointerId) return;
    s.pointerId = null;
    setPressed(false);
    if (s.sliding) settleSlide();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!s.listening) return;
    const held = performance.now() - s.downAt;
    const isHold = c.mode === 'hold' || (c.mode === 'auto' && held >= c.holdAfter);
    if (s.ownPress) {
      if (isHold) end('release');
    } else {
      end(held < c.holdAfter ? 'tap' : 'release');
    }
  };

  const onKeyDown = (e: RKeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === 'Escape') {
      end('escape');
      return;
    }
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      if (st.current.listening) end('key');
      else begin('key');
    }
  };

  const onClick = (e: RMouseEvent<HTMLButtonElement>): void => {
    const pointerType = (e.nativeEvent as PointerEvent).pointerType;
    if (e.detail === 0 && st.current.pointerId === null && !pointerType) {
      if (st.current.listening) end('key');
      else begin('key');
    }
  };

  useEffect(() => {
    if (!pressed) return undefined;
    const stop = () => end('blur');
    const onVis = () => {
      if (document.hidden) stop();
    };
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pressed]);

  useEffect(() => {
    if (disabled) end('disabled');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  useEffect(() => {
    const s = st.current;
    return () => {
      end('unmount');
      cancelAnimationFrame(s.raf);
      void s.audio?.ctx.close().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared-stream mode: attach the analyser to the parent's stream when it
  // arrives; detach (without stopping its tracks) when it goes away.
  useEffect(() => {
    const s = st.current;
    if (!useExternalStream || reactive !== 'mic') return;
    if (listening && externalStream) {
      attachStream(s, externalStream, true);
    } else if (!externalStream && s.audio?.external) {
      s.audio.src?.disconnect();
      s.audio.stream = null;
      s.audio.external = false;
      s.audio.src = null;
      s.audio.analyser = null;
      s.audio.buf = null;
    }
  }, [listening, externalStream, useExternalStream, reactive]);

  // Programmatic start (e.g. exam auto-start). begin() is a no-op if already listening.
  useEffect(() => {
    if (autoBeginSignal) begin('auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBeginSignal]);

  const radius = shape === 'rounded' ? Math.round(size * 0.29) : size / 2;
  const hit = Math.max(0, Math.min(10, (44 - size) / 2));
  const timeSize = Math.max(10, Math.round(size * 0.36));
  const clockW = showTime ? Math.round(timeSize * 2.5) + 4 : 0;
  const waveW = waveform ? Math.round(size * 1.9) : 0;
  const extra = clockW + waveW;

  const style = {
    '--vp-accent': accentColor,
    '--vp-icon': iconColor,
    '--vp-bg': background,
    '--vp-size': `${size}px`,
    '--vp-radius': `${radius}px`,
    '--vp-reach': `${reach}px`,
    '--vp-extra': `${extra}px`,
    '--vp-clock-w': `${clockW}px`,
    '--vp-wave-w': `${waveW}px`,
    '--vp-stop': `${Math.round(size * 0.32)}px`,
    '--vp-icon-size': `${Math.round(size * 0.54)}px`,
    '--vp-time-size': `${timeSize}px`,
    '--vp-open': `${openDuration}ms`,
    '--vp-press': String(pressScale),
    '--vp-hit': `${hit}px`,
  } as CSSProperties;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={listening}
      className={`voice-pill${className ? ` ${className}` : ''}`}
      data-state={listening ? 'listening' : 'idle'}
      data-pressed={pressed ? '' : undefined}
      data-input={input}
      data-time={showTime ? '' : undefined}
      ref={rootRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
      style={style}
    >
      <span className="voice-pill__capsule" aria-hidden="true" />
      {waveform ? <canvas ref={waveRef} className="voice-pill__wave" aria-hidden="true" /> : null}
      {slideToCancel ? (
        <span className="voice-pill__cancel">
          <HugeiconsIcon icon={ArrowLeft01Icon} size={12} strokeWidth={2.2} />
          <span>Hủy</span>
        </span>
      ) : null}
      {showTime ? (
        <span ref={timeRef} className="voice-pill__time" aria-hidden="true">
          0:00
        </span>
      ) : null}
      <span className="voice-pill__glyph">
        <span className="voice-pill__mic">
          <HugeiconsIcon icon={Mic01Icon} size={Math.round(size * 0.54)} strokeWidth={2} />
        </span>
        <span className="voice-pill__stop" aria-hidden="true" />
      </span>
      {/* Screen-reader announcement of recorder state changes. */}
      <span
        aria-live="polite"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {listening ? 'Đang ghi âm — bấm lần nữa để dừng' : 'Đã dừng ghi âm'}
      </span>
    </button>
  );
}
