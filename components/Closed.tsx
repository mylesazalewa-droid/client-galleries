import type { Studio } from "@/lib/types";

/** Shown to clients after a gallery's expiry date. */
export default function Closed({ studio, title }: { studio: Studio; title: string }) {
  return (
    <main className="center-page">
      <div className="lock">
        <div className="eyebrow">{studio.name}</div>
        <h1 className="serif">{title}</h1>
        <p style={{ color: "var(--muted)", margin: "0 auto", maxWidth: "36ch" }}>
          This gallery has closed. If you still need your files, reach out and they can be shared again.
        </p>
        {studio.email && (
          <a className="btn primary" href={`mailto:${studio.email}?subject=${encodeURIComponent(`Gallery: ${title}`)}`} style={{ marginTop: 22 }}>
            Email {studio.name.split(" ")[0]}
          </a>
        )}
      </div>
    </main>
  );
}
