// Draws the demo-mode sample "photos" as SVG landscapes, so the demo needs no image files.
// Not used once Google Drive is connected.

const PALETTES: [string, string, string][] = [
  ["#121830", "#e97850", "#fac88c"],
  ["#0a1e28", "#3c8c96", "#dcebe6"],
  ["#28141e", "#b4463c", "#f0aa6e"],
  ["#14161a", "#5a6478", "#c8cdd7"],
  ["#0f281e", "#6e965a", "#ebe6be"],
  ["#1e1432", "#965aaa", "#fad2c8"],
];

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
}

function landscape(n: number, w: number, h: number) {
  const r = rng(n * 9973 + 7);
  const [dark, mid, light] = PALETTES[n % PALETTES.length];
  const sx = w * (0.2 + r() * 0.6), sy = h * (0.35 + r() * 0.2), sr = Math.min(w, h) * (0.06 + r() * 0.05);
  let hills = "";
  for (let layer = 0; layer < 4; layer++) {
    const base = h * (0.55 + layer * 0.11), amp = (h * (0.04 + r() * 0.08)) / (layer + 1);
    const f1 = 1 + r() * 2, f2 = 4 + r() * 5, ph = r() * 6;
    const pts = [`0,${h}`];
    for (let x = 0; x <= w + 40; x += 40) {
      const y = base - amp * Math.sin((x / w) * f1 * Math.PI + ph) - amp * 0.35 * Math.sin((x / w) * f2 * Math.PI);
      pts.push(`${x},${y.toFixed(1)}`);
    }
    pts.push(`${w},${h}`);
    hills += `<polygon points="${pts.join(" ")}" fill="${mix(mid, dark, 0.35 + layer * 0.2)}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dark}"/><stop offset=".6" stop-color="${mid}"/><stop offset="1" stop-color="${light}"/></linearGradient>
<radialGradient id="glow"><stop offset="0" stop-color="${light}" stop-opacity=".55"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#sky)"/>
<circle cx="${sx}" cy="${sy}" r="${sr * 4}" fill="url(#glow)"/>
<circle cx="${sx}" cy="${sy}" r="${sr}" fill="${mix(light, "#ffffff", 0.5)}"/>
${hills}
</svg>`;
}

export async function GET(req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const n = Number(file.match(/(\d+)/)?.[1] ?? 1);
  const url = new URL(req.url);
  const w = Math.min(Number(url.searchParams.get("w")) || 2400, 4000);
  const h = Math.min(Number(url.searchParams.get("h")) || 1600, 4000);
  return new Response(landscape(n, w, h), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
