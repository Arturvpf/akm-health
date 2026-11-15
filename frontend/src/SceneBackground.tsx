import { useEffect, useRef } from 'react';
import type { PageId } from './navigation';
import { createScene, type SceneId } from './scene-drawing';
import './scene.css';

/** Each screen gets an ambient scene that matches what it does. */
export const SCENE_BY_PAGE: Record<PageId, SceneId> = {
  home: 'stars',
  dashboard: 'telemetry',
  register: 'pulse',
  history: 'telemetry',
  investigation: 'radar',
  scenarios: 'orbits',
  environments: 'dust',
  body: 'pulse',
  'self-care': 'constellation',
};

const FRAME_MS = 1000 / 30;
const MAX_PIXEL_RATIO = 1.5;

/**
 * Decorative animated canvas behind the page. It never takes focus or pointer input, pauses while the tab is
 * hidden, runs at 30 frames per second, and shows a single still frame when the person prefers reduced motion.
 */
export function SceneBackground({ page }: { page: PageId }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneId = SCENE_BY_PAGE[page];

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    const scene = createScene(sceneId);
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastDraw = 0;
    let elapsed = 0;
    let lastTick = 0;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = Math.round(width * ratio);
      canvas!.height = Math.round(height * ratio);
      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint();
    }
    function paint() {
      ctx!.clearRect(0, 0, width, height);
      scene.draw(ctx!, elapsed, width, height);
    }
    function loop(now: number) {
      frame = requestAnimationFrame(loop);
      if (now - lastDraw < FRAME_MS) return;
      elapsed += lastTick ? Math.min((now - lastTick) / 1000, 0.1) : 0;
      lastTick = now;
      lastDraw = now;
      paint();
    }
    function start() {
      cancelAnimationFrame(frame);
      lastTick = 0;
      if (reduceQuery.matches || document.hidden) return;
      frame = requestAnimationFrame(loop);
    }
    function onChange() {
      if (reduceQuery.matches) elapsed = 4; // A pleasant still frame instead of motion.
      start();
      paint();
    }

    elapsed = reduceQuery.matches ? 4 : 0;
    resize();
    start();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', start);
    reduceQuery.addEventListener('change', onChange);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', start);
      reduceQuery.removeEventListener('change', onChange);
    };
  }, [sceneId]);

  // The key restarts the fade-in whenever the screen changes its scene.
  return <canvas key={sceneId} ref={canvasRef} className="scene-canvas" data-scene={sceneId} aria-hidden="true" />;
}
