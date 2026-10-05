import Link from "next/link";

export default function NotFound() {
  return (
    <main className="center-page">
      <div className="lock">
        <div className="eyebrow">404</div>
        <h1 className="serif">This gallery isn&apos;t here</h1>
        <p style={{ color: "var(--muted)" }}>The link may have changed or the gallery was taken down.</p>
        <Link className="btn" href="/" style={{ marginTop: 18 }}>Go home</Link>
      </div>
    </main>
  );
}
