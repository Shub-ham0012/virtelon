export function linePoints(data: number[], w: number, h: number, padX: number, padY: number): [number, number][] {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? (w - padX * 2) / (data.length - 1) : 0;
  return data.map((v, i) => [padX + i * stepX, padY + (h - padY * 2) * (1 - (v - min) / range)]);
}

/** Catmull-Rom to cubic-bezier smoothing — softer curves than straight segments between points. */
export function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  if (pts.length < 3) return "M" + pts.map((p) => p.join(",")).join(" L");
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}
