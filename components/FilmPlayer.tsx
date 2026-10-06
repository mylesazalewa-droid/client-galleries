"use client";
import { useEffect, useRef, useState } from "react";
import type { MediaItem, WatermarkSpec } from "@/lib/types";
import { Watermark } from "./Brand";

type Props = {
  item: MediaItem;
  autoPlay?: boolean;
  allowDownload: boolean;
  watermark?: WatermarkSpec;
  /** called when the viewer picks another format (so download menus can follow) */
  onVersion?: (id: string) => void;
  /** website embed: no format bar, fills the frame */
  bare?: boolean;
};

/** Video player with a format switcher (16:9 / 9:16 / 1:1…) and captions, keeping the playhead when switching. */
export default function FilmPlayer({ item, autoPlay, allowDownload, watermark, onVersion, bare }: Props) {
  const versions = item.versions ?? [];
  const [vid, setVid] = useState(versions[0]?.id ?? item.id);
  const current = versions.find((v) => v.id === vid);
  const src = current?.src ?? item.src;
  const ref = useRef<HTMLVideoElement>(null);
  const resume = useRef<{ t: number; playing: boolean } | null>(null);

  useEffect(() => setVid(item.versions?.[0]?.id ?? item.id), [item.id, item.versions]);

  function pick(id: string) {
    const v = ref.current;
    if (v) resume.current = { t: v.currentTime, playing: !v.paused };
    setVid(id);
    onVersion?.(id);
  }

  return (
    <div className={bare ? "film bare" : "film"}>
      <div className="film-stage">
        <video
          key={src}
          ref={ref}
          src={src}
          poster={item.full || undefined}
          controls
          autoPlay={autoPlay || !!resume.current?.playing}
          muted={bare && autoPlay ? true : undefined}
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
          controlsList={allowDownload ? undefined : "nodownload"}
          disablePictureInPicture={!!watermark}
          onContextMenu={watermark ? (e) => e.preventDefault() : undefined}
          onLoadedMetadata={(e) => {
            if (resume.current) {
              e.currentTarget.currentTime = Math.min(resume.current.t, e.currentTarget.duration || resume.current.t);
              resume.current = null;
            }
          }}
        >
          {item.captions?.map((c, i) => (
            <track key={c.id} kind="captions" src={c.src} srcLang={c.lang ?? "en"} label={c.label} />
          ))}
        </video>
        {watermark && <Watermark spec={watermark} big />}
      </div>
      {!bare && (versions.length > 1 || item.captions?.length) && (
        <div className="film-bar">
          {versions.length > 1 && (
            <div className="formats" role="radiogroup" aria-label="Format">
              {versions.map((v) => (
                <button key={v.id} role="radio" aria-checked={v.id === vid} className={v.id === vid ? "on" : ""} onClick={() => pick(v.id)}>
                  <span className="ratio" style={{ aspectRatio: `${v.width} / ${v.height}` }} />
                  {v.label}
                </button>
              ))}
            </div>
          )}
          {item.captions?.length ? <span className="cc" title="Turn captions on with the CC button in the player">CC available</span> : null}
        </div>
      )}
    </div>
  );
}
