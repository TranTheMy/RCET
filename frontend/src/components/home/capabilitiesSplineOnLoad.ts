import type { Application } from '@splinetool/runtime';

/** Giới hạn DPR để giảm fill-rate GPU (runtime có thể gán renderer sau load). */
const CAPABILITIES_SPLINE_MAX_DPR = 1.35;

type AppWithRenderer = Application & {
  renderer?: { setPixelRatio?: (value: number) => void };
};

function applyCapabilitiesDprCap(app: Application) {
  const target = Math.min(
    CAPABILITIES_SPLINE_MAX_DPR,
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  );
  const renderer = (app as AppWithRenderer).renderer;
  renderer?.setPixelRatio?.(target);
}

/**
 * onLoad cho robot Capabilities: nền trong suốt + hạ DPR sau vài frame (sau resize nội bộ).
 */
export function onCapabilitiesSplineLoaded(app: Application) {
  app.setBackgroundColor('transparent');
  applyCapabilitiesDprCap(app);
  requestAnimationFrame(() => {
    applyCapabilitiesDprCap(app);
    requestAnimationFrame(() => applyCapabilitiesDprCap(app));
  });
}
