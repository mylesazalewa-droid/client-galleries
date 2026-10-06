import type { Metadata } from "next";

export const metadata: Metadata = { title: "Film" };

/** Website embeds are turned off: films are shared as links to the film page instead. */
export default function EmbedPage() {
  return (
    <div className="embed">
      <p className="embed-msg">This film isn&apos;t available here. Ask for a link to watch it.</p>
    </div>
  );
}
