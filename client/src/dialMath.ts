// SVG geometry helpers for the semicircular dial. Dial values run 1..180 where
// 1 is the far left of the arc and 180 the far right.

export function polar(cx: number, cy: number, r: number, value: number): [number, number] {
  const rad = ((180 - value) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
}

/** Annular sector path between dial values `from` and `to` (clamped to the arc). */
export function sectorPath(
  cx: number,
  cy: number,
  from: number,
  to: number,
  r1: number,
  r2: number,
): string {
  const f = Math.max(0, Math.min(180, from));
  const t = Math.max(0, Math.min(180, to));
  const [x1, y1] = polar(cx, cy, r2, f);
  const [x2, y2] = polar(cx, cy, r2, t);
  const [x3, y3] = polar(cx, cy, r1, t);
  const [x4, y4] = polar(cx, cy, r1, f);
  return `M ${x1} ${y1} A ${r2} ${r2} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${r1} ${r1} 0 0 0 ${x4} ${y4} Z`;
}
