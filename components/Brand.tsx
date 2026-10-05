import type { Studio } from "@/lib/types";

export function Brand({ studio, className = "brand serif" }: { studio: Studio; className?: string }) {
  const inner = studio.logo ? <img src={studio.logo} alt={studio.name} className="brand-logo" /> : studio.name;
  return studio.url ? <a href={studio.url} className={className}>{inner}</a> : <span className={className}>{inner}</span>;
}

/** Repeated studio name over previews while a payment hold is on. */
export function Watermark({ text, count = 6 }: { text: string; count?: number }) {
  return (
    <span className="wm" aria-hidden>
      {Array.from({ length: count }, (_, i) => <span key={i}>{text} · Preview</span>)}
    </span>
  );
}

