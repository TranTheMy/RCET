
export function isHeroSplineEnabled(): boolean {
  if (import.meta.env.VITE_DISABLE_SPLINE === 'true') return false;
  if (import.meta.env.VITE_HERO_SPLINE === 'false') return false;
  return true;
}
