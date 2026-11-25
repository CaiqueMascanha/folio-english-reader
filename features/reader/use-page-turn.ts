'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { captureSheet } from './page-snapshot';
import { drawPaperTurn } from './paper-curl';
import './page-turn.css';

const turnDuration = 720;

export function usePageTurn(sheetRef: RefObject<HTMLDivElement | null>) {
  const stopTurn = useRef<(() => void) | null>(null);
  useEffect(() => () => stopTurn.current?.(), []);

  return useCallback((direction: number, showPage: () => void) => {
    stopTurn.current?.();
    const sheet = sheetRef.current;
    const area = sheet?.parentElement;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!sheet || !area || motion.matches || document.hidden) {
      showPage();
      return;
    }

    const bounds = sheet.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 1.5, 2048 / Math.max(bounds.width, bounds.height));
    const before = captureSheet(sheet, scale);
    flushSync(showPage);
    if (!before) return;
    const after = captureSheet(sheet, scale);
    if (!after) return;

    const layer = document.createElement('canvas');
    const ctx = layer.getContext('2d');
    if (!ctx) return;
    const { width, height } = bounds;
    layer.className = 'paper-turn-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.width = Math.round(width * scale);
    layer.height = Math.round(height * scale);
    sheet.appendChild(layer);
    ctx.scale(layer.width / width, layer.height / height);

    const paper = getComputedStyle(sheet).backgroundColor;
    const turn = { ctx, before, after, paper, width: bounds.width, height: bounds.height,
      spread: area.classList.contains('reading-spread'), backward: direction < 0 };
    let frame = 0;
    const visualViewport = window.visualViewport;
    function stop() {
      cancelAnimationFrame(frame);
      layer.remove();
      window.removeEventListener('resize', stop);
      visualViewport?.removeEventListener('resize', stop);
      document.removeEventListener('visibilitychange', stop);
      motion.removeEventListener('change', stop);
      stopTurn.current = null;
    }
    stopTurn.current = stop;
    window.addEventListener('resize', stop);
    visualViewport?.addEventListener('resize', stop);
    document.addEventListener('visibilitychange', stop);
    motion.addEventListener('change', stop);

    const started = performance.now();
    function draw(now: number) {
      const t = Math.min(1, Math.max(0, (now - started) / turnDuration));
      if (t === 1) { stop(); return; }
      drawPaperTurn(turn, t * t * (3 - 2 * t));
      frame = requestAnimationFrame(draw);
    }
    draw(started);
  }, [sheetRef]);
}
