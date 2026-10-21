import Link from "next/link";
import type { Project } from "@/lib/site";

export default function ProjectCard({ p }: { p: Project }) {
  return (
    <Link href={`/work/${p.slug}`} className="site-proj">
      <span className="site-proj-img">{p.cover ? <img src={p.cover} alt="" loading="lazy" /> : null}</span>
      <span className="site-proj-meta">
        <b>{p.title}</b>
        <span>{p.blurb || [p.client, p.videos ? `${p.videos} film${p.videos === 1 ? "" : "s"}` : "", p.photos ? `${p.photos} photos` : ""].filter(Boolean).join(" · ")}</span>
      </span>
    </Link>
  );
}
