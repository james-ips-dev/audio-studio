import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface RotaryKnobProps {
  label: string;
  subtitle?: string;          // Optional friendly label (e.g., "Brightness ☀️")
  value: number;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  bipolar?: boolean;          // Draws arc from center 12-o'clock position
  modulationOffset?: number;  // Optional live ghost ring offset (-1..+1 of range)
  accentColor?: string;       // Hex or CSS color (default '#38BDF8')
  size?: 'sm' | 'md' | 'lg';
  formatValue?: (val: number) => string;
  onChange: (nextValue: number) => void;
  disabled?: boolean;
}

const SIZE_MAP = {
  sm: { px: 42, stroke: 3.2, fontSize: 'text-[10px]' },
  md: { px: 54, stroke: 3.8, fontSize: 'text-[11px]' },
  lg: { px: 68, stroke: 4.4, fontSize: 'text-xs' },
} as const;

// Angles in degrees: -135 deg (7:30) to +135 deg (4:30) -> 270 deg total sweep
const START_ANGLE = -135;
const END_ANGLE = 135;
const SWEEP_ANGLE = END_ANGLE - START_ANGLE;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  if (Math.abs(endAngle - startAngle) < 0.1) return '';
  const first = Math.min(startAngle, endAngle);
  const second = Math.max(startAngle, endAngle);
  const start = polarToCartesian(cx, cy, r, second);
  const end = polarToCartesian(cx, cy, r, first);
  const largeArcFlag = second - first <= 180 ? '0' : '1';
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${largeArcFlag} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  label,
  subtitle,
  value,
  min = 0,
  max = 100,
  step = 0.01,
  defaultValue,
  bipolar = false,
  modulationOffset,
  accentColor = '#38BDF8',
  size = 'md',
  formatValue,
  onChange,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isFineMode, setIsFineMode] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const activePointersRef = useRef<Set<number>>(new Set());
  const dragStateRef = useRef<{
    lastY: number;
    accumValue: number;
  } | null>(null);
  const wheelFineTimeoutRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  const range = Math.max(1e-9, max - min);
  const clamped = Math.min(max, Math.max(min, value));
  const norm = (clamped - min) / range;

  const { px, stroke, fontSize } = SIZE_MAP[size];
  const center = px / 2;
  const radius = center - stroke - 3;

  const currentAngle = START_ANGLE + norm * SWEEP_ANGLE;
  const trackStartAngle = bipolar ? 0 : START_ANGLE;

  const pointerTip = polarToCartesian(center, center, radius - 3, currentAngle);
  const pointerBase = polarToCartesian(center, center, radius * 0.32, currentAngle);

  const quantizeAndClamp = useCallback(
    (raw: number, fine: boolean = false): number => {
      const bounded = Math.min(max, Math.max(min, raw));
      if (!step || step <= 0) return bounded;
      const effectiveStep = fine ? step * 0.1 : step;
      const quantized =
        Math.round((bounded - min) / effectiveStep) * effectiveStep + min;
      return Number(Math.min(max, Math.max(min, quantized)).toFixed(6));
    },
    [min, max, step]
  );

  // Latest refs for non-passive wheel listener
  const latestRef = useRef({
    clamped,
    range,
    step,
    disabled,
    onChange,
    quantizeAndClamp,
  });
  useEffect(() => {
    latestRef.current = {
      clamped,
      range,
      step,
      disabled,
      onChange,
      quantizeAndClamp,
    };
  }, [clamped, range, step, disabled, onChange, quantizeAndClamp]);

  // Native non-passive wheel listener for Scroll & Shift+Scroll fine adjustment
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const cur = latestRef.current;
      if (cur.disabled) return;
      e.preventDefault();
      e.stopPropagation();

      const fine = e.shiftKey;
      const dir = e.deltaY < 0 ? 1 : -1;
      const baseDelta =
        cur.step && cur.step > 0 ? cur.step : cur.range / 100;
      const delta = dir * (fine ? Math.min(baseDelta * 0.1, cur.range / 500) : baseDelta);

      if (fine) {
        setIsFineMode(true);
        if (wheelFineTimeoutRef.current !== null) {
          window.clearTimeout(wheelFineTimeoutRef.current);
        }
        wheelFineTimeoutRef.current = window.setTimeout(() => {
          setIsFineMode(false);
        }, 650);
      }

      cur.onChange(cur.quantizeAndClamp(cur.clamped + delta, fine));
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (wheelFineTimeoutRef.current !== null) {
        window.clearTimeout(wheelFineTimeoutRef.current);
      }
    };
  }, []);

  const handleReset = useCallback(() => {
    if (disabled) return;
    const resetTarget =
      defaultValue !== undefined
        ? defaultValue
        : bipolar
          ? (min + max) / 2
          : min;
    onChange(quantizeAndClamp(resetTarget, false));
  }, [disabled, defaultValue, bipolar, min, max, onChange, quantizeAndClamp]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    activePointersRef.current.add(e.pointerId);

    // Check double-tap within 280ms
    const now = performance.now();
    if (now - lastTapTimeRef.current < 280 && activePointersRef.current.size === 1) {
      lastTapTimeRef.current = 0;
      activePointersRef.current.clear();
      handleReset();
      return;
    }
    lastTapTimeRef.current = now;

    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      lastY: e.clientY,
      accumValue: clamped,
    };
    setIsDragging(true);
    setIsFineMode(e.shiftKey || activePointersRef.current.size > 1);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current || disabled) return;
    e.preventDefault();

    const fine = e.shiftKey || activePointersRef.current.size > 1;
    setIsFineMode(fine);

    const deltaPixels = dragStateRef.current.lastY - e.clientY;
    dragStateRef.current.lastY = e.clientY;

    const sensitivityPixels = fine ? 1400 : 140;
    const nextRaw = Math.min(
      max,
      Math.max(
        min,
        dragStateRef.current.accumValue +
          (deltaPixels / sensitivityPixels) * range
      )
    );
    dragStateRef.current.accumValue = nextRaw;

    onChange(quantizeAndClamp(nextRaw, fine));
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size === 0) {
      dragStateRef.current = null;
      setIsDragging(false);
      setIsFineMode(false);
    }
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore if pointer capture was already released
    }
  };

  const displayString = formatValue
    ? formatValue(clamped)
    : step >= 1 && !isFineMode
      ? Math.round(clamped).toString()
      : clamped.toFixed(2);

  // Optional live modulation ghost ring
  let modGhostArc = '';
  if (modulationOffset !== undefined && Math.abs(modulationOffset) > 0.005) {
    const modNorm = Math.min(1, Math.max(0, norm + modulationOffset));
    const modAngle = START_ANGLE + modNorm * SWEEP_ANGLE;
    modGhostArc = describeArc(center, center, radius + 2.5, currentAngle, modAngle);
  }

  return (
    <div
      ref={rootRef}
      className={`inline-flex flex-col items-center select-none touch-none-control ${
        disabled ? 'opacity-40 pointer-events-none' : 'cursor-ns-resize'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onDoubleClick={handleReset}
      title={`${label}: ${displayString} (Drag or Scroll • Hold Shift for 10× Fine • Double-click to Reset)`}
    >
      <div className="relative flex items-center justify-center">
        <svg width={px} height={px} className="overflow-visible">
          {/* Background sweep arc */}
          <path
            d={describeArc(center, center, radius, START_ANGLE, END_ANGLE)}
            fill="none"
            stroke="var(--knob-track, rgba(255,255,255,0.12))"
            strokeWidth={stroke}
            strokeLinecap="round"
          />

          {/* Active value arc */}
          <path
            d={describeArc(center, center, radius, trackStartAngle, currentAngle)}
            fill="none"
            stroke={accentColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            style={{
              filter: isDragging ? `drop-shadow(0 0 6px ${accentColor})` : undefined,
            }}
          />

          {/* Optional live modulation ghost arc */}
          {modGhostArc && (
            <path
              d={modGhostArc}
              fill="none"
              stroke="#FBBF24"
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.85}
            />
          )}

          {/* Inner rotary cap */}
          <circle
            cx={center}
            cy={center}
            r={radius - 4}
            fill="var(--knob-cap-bg, #12151E)"
            stroke={isDragging ? accentColor : 'var(--knob-cap-border, rgba(255,255,255,0.14))'}
            strokeWidth={1.2}
          />

          {/* Indicator needle */}
          <line
            x1={pointerBase.x}
            y1={pointerBase.y}
            x2={pointerTip.x}
            y2={pointerTip.y}
            stroke="var(--knob-needle, #F9FAFB)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>

        {isFineMode && (
          <span className="absolute -top-2 px-1 py-0.5 rounded bg-amber-500/95 text-black font-studio-mono text-[8px] font-bold tracking-wider uppercase shadow z-20 pointer-events-none">
            10× FINE
          </span>
        )}
      </div>

      {/* Numeric Readout */}
      <span
        className={`font-studio-mono ${fontSize} font-semibold tracking-tight leading-none mt-0.5`}
        style={{ color: isDragging ? accentColor : 'var(--knob-text, #E5E7EB)' }}
      >
        {displayString}
      </span>

      {/* Primary Label */}
      <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 leading-tight mt-0.5 text-center">
        {label}
      </span>

      {/* Optional Dual-Layer Friendly Subtitle */}
      {subtitle && (
        <span className="text-[9px] text-gray-500 leading-tight text-center">
          {subtitle}
        </span>
      )}
    </div>
  );
};
