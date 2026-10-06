import type { Studio, WatermarkSpec } from "@/lib/types";

export function Brand({ studio, className = "brand serif" }: { studio: Studio; className?: string }) {
  const inner = studio.logo ? <img src={studio.logo} alt={studio.name} className="brand-logo" /> : studio.name;
  return studio.url ? <a href={studio.url} className={className}>{inner}</a> : <span className={className}>{inner}</span>;
}

/** Your watermark over previews while a payment hold is on: tiled, one big mark in the center, or a corner mark. */
export function Watermark({ spec, big = false }: { spec: WatermarkSpec; big?: boolean }) {
  const cls = `wm2 wm-${spec.layout} ${big ? "big" : ""}`;
  const style = { opacity: spec.opacity } as React.CSSProperties;
  if (spec.src) {
    return spec.layout === "tile" ? (
      <span className={cls} style={{ ...style, backgroundImage: `url("${spec.src}")` }} aria-hidden />
    ) : (
      <span className={cls} style={style} aria-hidden><img src={spec.src} alt="" draggable={false} /></span>
    );
  }
  const text = spec.text ?? "";
  return spec.layout === "tile" ? (
    <span className={`${cls} txt`} style={style} aria-hidden>
      {Array.from({ length: big ? 60 : 14 }, (_, i) => <span key={i}>{text}</span>)}
    </span>
  ) : (
    <span className={`${cls} txt`} style={style} aria-hidden><span>{text}</span></span>
  );
}
