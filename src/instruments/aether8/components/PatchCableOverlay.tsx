import React, { useEffect, useRef } from 'react';
import type { PatchCable, SignalDomain } from '../types';

export interface PatchCableOverlayProps {
  chassisRef: React.RefObject<HTMLDivElement | null>;
  cables: PatchCable[];
  activeFromJack: {
    jackId: string;
    domain: SignalDomain;
    originalSourceJackId?: string;
  } | null;
  pointerPos: { x: number; y: number } | null;
}

const CABLE_COLORS: Record<SignalDomain, string> = {
  audio: '#38BDF8',
  cv: '#F59E0B',
  trig: '#F43F5E',
};

export const PatchCableOverlay: React.FC<PatchCableOverlayProps> = ({
  chassisRef,
  cables,
  activeFromJack,
  pointerPos,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const chassis = chassisRef.current;
    if (!canvas || !chassis) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastDraw = 0;

    const getJackCenter = (jackId: string): { x: number; y: number } | null => {
      const el = chassis.querySelector<HTMLElement>(
        `[data-jack-id="${jackId}"]`
      );
      if (!el) return null;
      const cRect = canvas.getBoundingClientRect();
      const jRect = el.getBoundingClientRect();
      return {
        x: jRect.left - cRect.left + jRect.width / 2,
        y: jRect.top - cRect.top + 8,
      };
    };

    const drawCatenaryCable = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      color: string,
      dashed = false
    ) => {
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const sag = Math.min(95, 22 + dist * 0.22);
      const midX = (x1 + x2) / 2;
      const midY = Math.max(y1, y2) + sag;

      ctx.save();
      if (dashed) {
        ctx.setLineDash([6, 4]);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(midX, midY, x2, y2);
      ctx.stroke();

      // Plug end caps
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x1, y1, 3.8, 0, Math.PI * 2);
      ctx.arc(x2, y2, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const render = (ts: number) => {
      rafId = requestAnimationFrame(render);
      if (ts - lastDraw < 33) return; // Cap cable animation to ~30fps max to save CPU
      lastDraw = ts;
      const rect = chassis.getBoundingClientRect();
      if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
        canvas.width = Math.floor(rect.width);
        canvas.height = Math.floor(rect.height);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const cable of cables) {
        const p1 = getJackCenter(cable.from);
        const p2 = getJackCenter(cable.to);
        if (p1 && p2) {
          drawCatenaryCable(
            p1.x,
            p1.y,
            p2.x,
            p2.y,
            CABLE_COLORS[cable.type] || '#38BDF8',
            false
          );
        }
      }

      if (activeFromJack && pointerPos) {
        // In daisy-chain mode, start the visual dangling line from the endpoint jack being chained from
        const visualFromId = activeFromJack.jackId;
        const p1 = getJackCenter(visualFromId);
        const cRect = canvas.getBoundingClientRect();
        if (p1) {
          drawCatenaryCable(
            p1.x,
            p1.y,
            pointerPos.x - cRect.left,
            pointerPos.y - cRect.top,
            CABLE_COLORS[activeFromJack.domain],
            true
          );
        }
      }
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [cables, activeFromJack, pointerPos, chassisRef]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-20 w-full h-full"
    />
  );
};
