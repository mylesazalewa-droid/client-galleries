"use client";
import type { MediaItem } from "@/lib/types";
import { Download } from "./icons";

/** One download for a photo; a menu of every format plus captions for a film. */
export default function DownloadMenu({ item, className = "icon-btn", label }: { item: MediaItem; className?: string; label?: string }) {
  const many = (item.versions?.length ?? 0) > 1 || (item.captions?.length ?? 0) > 0;
  if (!many) {
    return (
      <a className={className} href={item.download} download={item.name} aria-label={`Download ${item.name}`} title="Download">
        <Download />{label && <span>{label}</span>}
      </a>
    );
  }
  return (
    <details className="menu dl-menu">
      <summary className={className} aria-label="Download" title="Download">
        <Download />{label && <span>{label}</span>}
      </summary>
      <div className="menu-pop">
        {(item.versions ?? [{ id: item.id, label: "Film", name: item.name, download: item.download }]).map((v) => (
          <a key={v.id} href={v.download} download={v.name}>{v.label} <span>{v.name.split(".").pop()?.toUpperCase()}</span></a>
        ))}
        {item.captions?.map((c) => (
          <a key={c.id} href={c.download} download={c.name}>{c.label} captions <span>{c.name.split(".").pop()?.toUpperCase()}</span></a>
        ))}
      </div>
    </details>
  );
}
