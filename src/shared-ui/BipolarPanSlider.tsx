import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface BipolarPanSliderProps {
  value: number; // -1.0 (Full Left) .. 0.0 (Center) .. +1.0 (Full Right)
  onChange: (nextPan: number) => void;
  accentColor?: string;
  label?: string;
  showHeader?: boolean;
  compact?: boolean;
  title?: string;
}

export const BipolarPanSlider: React.FC<BipolarPanSliderProps> = ({
  value,
  onChange,
  accentColor = '#38BDF8',
  label = 'PAN',
  showHeader = true,
  compact = false,
  title,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isFineMode, setIsFineMode] = useState(false);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    lastX: number;
    accumPan: number;
  } | null>(null);
  const wheelFineTimerRef = useRef<number | null>(null);

  const clamped = Math.max(-1, Math.min(1, value));

  const clampAndRound = useCallback((raw: number, fine: boolean) => {
    const bounded = Math.max(-1, Math.min(1, raw));
    const step = fine ? 0.005 : 0.02;
    return Number((Math.round(bounded / step) * step).toFixed(4));
  }, []);

  const latestRef = useRef({ clamped, onChange, clampAndRound });
  useEffect(() => {
    latestRef.current = { clamped, onChange, clampAndRound };
  }, [clamped, onChange, clampAndRound]);

  // Native non-passive wheel listener for Scroll & Shift+Scroll fine pan control
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const fine = e.shiftKey;
      const dir = e.deltaY < 0 || e.deltaX > 0 ? 1 : -1;
      const step = fine ? 0.005 : 0.05;
      if (fine) {
        setIsFineMode(true);
        if (wheelFineTimerRef.current !== null) {
          window.clearTimeout(wheelFineTimerRef.current);
        }
        wheelFineTimerRef.current = window.setTimeout(() => {
          setIsFineMode(false);
        }, 650);
      }
      const cur = latestRef.current;
      cur.onChange(cur.clampAndRound(cur.clamped + dir * step, fine));
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (wheelFineTimerRef.current !== null) {
        window.clearTimeout(wheelFineTimerRef.current);
      }
    };
  }, []);

  const formatPan = (p: number) => {
    if (Math.abs(p) < 0.015) return 'C';
    if (p < 0) return `L${Math.round(Math.abs(p) * 100)}`;
    return `R${Math.round(p * 100)}`;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const fine = e.shiftKey;
    setIsDragging(true);
    setIsFineMode(fine);

    let initialPan = clamped;
    if (!fine) {
      const rect = el.getBoundingClientRect();
      const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
      initialPan = clampAndRound(relX * 2 - 1, false);
      onChange(initialPan);
    }

    dragRef.current = {
      lastX: e.clientX,
      accumPan: initialPan,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const fine = e.shiftKey;
    setIsFineMode(fine);

    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - dragRef.current.lastX;
    dragRef.current.lastX = e.clientX;

    const sensitivityWidth = fine ? Math.max(450, rect.width * 8) : Math.max(40, rect.width);
    const nextRaw = Math.max(
      -1,
      Math.min(1, dragRef.current.accumPan + (dx / sensitivityWidth) * 2)
    );
    dragRef.current.accumPan = nextRaw;
    onChange(clampAndRound(nextRaw, fine));
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    dragRef.current = null;
    setIsDragging(false);
    setIsFineMode(false);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div
      title={title}
      className="w-full select-none touch-none-control"
      onClick={(e) => e.stopPropagation()}
    >
      {showHeader && (
        <div
          className={`flex items-center justify-between font-studio-mono ${
            compact ? 'text-[7.5px] mb-0.5' : 'text-[8.5px] mb-0.5'
          } text-gray-400`}
        >
          <span>{label}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(0);
            }}
            title="Click to reset Pan to Center (0)"
            className="font-bold hover:underline cursor-pointer"
            style={{ color: Math.abs(clamped) < 0.015 ? accentColor : '#F3F4F6' }}
          >
            {formatPan(clamped)}
          </button>
        </div>
      )}

      {/* Center-Origin Bipolar Track */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onChange(0);
        }}
        title={`Pan: ${formatPan(clamped)} (Drag or Scroll • Hold Shift for 10× Fine • Double-click to Center)`}
        className={`w-full ${
          compact ? 'h-3' : 'h-3.5'
        } rounded bg-black/65 border border-white/15 relative flex items-center cursor-ew-resize overflow-visible`}
      >
        {/* Center 0 Notch */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/40 -translate-x-1/2 z-0 pointer-events-none" />

        {/* Bipolar Fill Bar (Originates at Center 50% and fills Left or Right) */}
        {clamped < -0.005 ? (
          <div
            className="absolute right-1/2 top-0.5 bottom-0.5 rounded-l pointer-events-none"
            style={{
              width: `${Math.min(50, Math.abs(clamped) * 50)}%`,
              backgroundColor: accentColor,
              opacity: 0.78,
            }}
          />
        ) : clamped > 0.005 ? (
          <div
            className="absolute left-1/2 top-0.5 bottom-0.5 rounded-r pointer-events-none"
            style={{
              width: `${Math.min(50, clamped * 50)}%`,
              backgroundColor: accentColor,
              opacity: 0.78,
            }}
          />
        ) : null}

        {/* Thumb Handle */}
        <div
          className="absolute -top-0.5 -bottom-0.5 w-2 rounded-xs bg-white shadow border z-10 -translate-x-1/2 pointer-events-none"
          style={{
            left: `${((clamped + 1) / 2) * 100}%`,
            borderColor: accentColor,
            boxShadow: isDragging ? `0 0 6px ${accentColor}` : undefined,
          }}
        />

        {isFineMode && (
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-1 py-0.2 rounded bg-amber-500 text-black font-studio-mono text-[7px] font-bold uppercase shadow z-30 pointer-events-none whitespace-nowrap">
            10× FINE
          </span>
        )}
      </div>
    </div>
  );
};
