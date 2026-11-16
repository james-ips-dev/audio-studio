import { useEffect } from 'react';

function dispatchReactRangeValue(input: HTMLInputElement, nextVal: number): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  );
  descriptor?.set?.call(input, String(Number(nextVal.toFixed(6))));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function getRangeMetadata(input: HTMLInputElement) {
  const min = parseFloat(input.min || '0');
  const max = parseFloat(input.max || '100');
  const range = Math.max(1e-9, max - min);

  if (input.dataset.origStep === undefined) {
    input.dataset.origStep = input.getAttribute('step') ?? '1';
  }
  const origStepStr = input.dataset.origStep;
  const baseStep =
    origStepStr === 'any' || !origStepStr
      ? range / 100
      : parseFloat(origStepStr) || range / 100;

  const current = parseFloat(input.value || String(min));
  return { min, max, range, baseStep, origStepStr, current };
}

/**
 * Global desktop precision controller for all `<input type="range">` elements across
 * Groovebox, AETHER-8, and RileyRack 800:
 * - Mouse Wheel Scroll: Steps slider up/down smoothly without scrolling the page.
 * - Shift + Mouse Wheel Scroll: 10× fine precision micro-stepping.
 * - Shift + Click-Hold-Drag: Overrides coarse thumb-jumping with 10× fine relative dragging.
 */
export function useGlobalRangePrecision(): void {
  useEffect(() => {
    let activeDrag: {
      input: HTMLInputElement;
      pointerId: number;
      lastX: number;
      lastY: number;
      accumVal: number;
      fineLocked: boolean;
    } | null = null;

    const onWheel = (e: WheelEvent) => {
      const target = e.target;
      if (
        !(target instanceof HTMLInputElement) ||
        target.type !== 'range' ||
        target.disabled
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const { min, max, range, baseStep, origStepStr, current } =
        getRangeMetadata(target);
      const fine = e.shiftKey;

      if (fine) {
        target.step = 'any';
      } else if (origStepStr) {
        target.step = origStepStr;
      }

      const dir = e.deltaY < 0 || e.deltaX > 0 ? 1 : -1;
      const stepDelta = fine
        ? Math.min(baseStep * 0.1, range / 500)
        : baseStep;
      const rawNext = Math.min(max, Math.max(min, current + dir * stepDelta));
      const nextVal = fine
        ? rawNext
        : Math.round((rawNext - min) / baseStep) * baseStep + min;

      dispatchReactRangeValue(
        target,
        Math.min(max, Math.max(min, nextVal))
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (
        !(target instanceof HTMLInputElement) ||
        target.type !== 'range' ||
        target.disabled
      ) {
        return;
      }

      const { current } = getRangeMetadata(target);
      activeDrag = {
        input: target,
        pointerId: e.pointerId,
        lastX: e.clientX,
        lastY: e.clientY,
        accumVal: current,
        fineLocked: e.shiftKey,
      };

      // If Shift is held on initial click, prevent native thumb jump so relative fine drag begins from current value
      if (e.shiftKey) {
        e.preventDefault();
        target.step = 'any';
        try {
          target.setPointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!activeDrag || e.pointerId !== activeDrag.pointerId) return;
      const { input } = activeDrag;
      const { min, max, range, origStepStr, current } = getRangeMetadata(input);

      if (e.shiftKey) {
        if (!activeDrag.fineLocked) {
          activeDrag.fineLocked = true;
          activeDrag.accumVal = current;
          activeDrag.lastX = e.clientX;
          activeDrag.lastY = e.clientY;
        }
        e.preventDefault();
        e.stopPropagation();
        input.step = 'any';

        const dx = e.clientX - activeDrag.lastX;
        const dy = activeDrag.lastY - e.clientY;
        activeDrag.lastX = e.clientX;
        activeDrag.lastY = e.clientY;

        const rect = input.getBoundingClientRect();
        const fineSpan = Math.max(600, rect.width * 8);
        const delta = ((dx + dy * 0.5) / fineSpan) * range;
        const nextVal = Math.min(
          max,
          Math.max(min, activeDrag.accumVal + delta)
        );
        activeDrag.accumVal = nextVal;
        dispatchReactRangeValue(input, nextVal);
      } else if (activeDrag.fineLocked) {
        activeDrag.fineLocked = false;
        if (origStepStr) {
          input.step = origStepStr;
        }
      }
    };

    const onPointerUpOrCancel = (e: PointerEvent) => {
      if (!activeDrag || e.pointerId !== activeDrag.pointerId) return;
      const { input } = activeDrag;
      const origStepStr = input.dataset.origStep;
      if (origStepStr && !e.shiftKey) {
        input.step = origStepStr;
      }
      try {
        if (input.hasPointerCapture(e.pointerId)) {
          input.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      activeDrag = null;
    };

    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('pointermove', onPointerMove, { capture: true });
    window.addEventListener('pointerup', onPointerUpOrCancel, { capture: true });
    window.addEventListener('pointercancel', onPointerUpOrCancel, {
      capture: true,
    });

    return () => {
      window.removeEventListener('wheel', onWheel, { capture: true });
      window.removeEventListener('pointerdown', onPointerDown, {
        capture: true,
      });
      window.removeEventListener('pointermove', onPointerMove, {
        capture: true,
      });
      window.removeEventListener('pointerup', onPointerUpOrCancel, {
        capture: true,
      });
      window.removeEventListener('pointercancel', onPointerUpOrCancel, {
        capture: true,
      });
    };
  }, []);
}
