import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { studio } from "@/lib/config";
import { readActivity } from "@/lib/activity";
import { loadAll } from "@/lib/galleries";
import { currentOwner } from "@/lib/owner";
import { payParts, usd } from "@/lib/payments";
import { stripeReady } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const owner = await currentOwner();
  if (!owner) redirect("/admin");
  const [records, rows] = await Promise.all([loadAll(true).catch(() => []), readActivity().catch(() => [])]);
  const due = records
    .filter((g) => g.settings.hold)
    .map((g) => {
      const paid = new Set(g.paidLinks ?? []);
      const parts = payParts(g.settings);
      const left = parts.filter((p) => !paid.has(p.id));
      return { g, parts, left, cents: left.reduce((n, p) => n + p.amount, 0) };
    });
  const owed = due.reduce((n, d) => n + d.cents, 0);
  const paidRows = rows.filter((r) => r.event === "Paid" || r.event === "Marked paid");

  return (
    <AdminShell studio={studio} email={owner.email} demo={owner.demo}>
      <div className="admin-head">
        <div>
          <div className="eyebrow">{stripeReady() ? "Stripe connected" : "Stripe not connected"}</div>
          <h1 className="serif">Payments</h1>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat"><b>{usd(owed)}</b><span>outstanding</span></div>
        <div className="stat"><b>{due.length}</b><span>galleries on hold until paid</span></div>
        <div className="stat"><b>{paidRows.length}</b><span>payments received</span></div>
      </div>

      <section className="page-sec">
        <h2>Waiting on payment</h2>
        {due.length ? (
          <div className="list-page">
            {due.map(({ g, parts, left, cents }) => (
              <Link key={g.id} href={`/admin/g/${g.id}#payment`} className="list-row">
                {(g.cover ?? g.items[0])?.thumb ? <img src={(g.cover ?? g.items[0])!.thumb} alt="" /> : <span className="ph" />}
                <span className="lr-main">
                  <span className="lr-title" style={{ display: "block" }}>{g.title}</span>
                  <span className="lr-sub">
                    {g.settings.client ? `${g.settings.client} · ` : ""}
                    {parts.length > 1 ? `${parts.length - left.length} of ${parts.length} parts paid` : parts.length ? "Payment link sent" : "No payment link yet"}
                  </span>
                </span>
                <span className="lr-right"><b>{cents ? usd(cents) : "—"}</b></span>
              </Link>
            ))}
          </div>
        ) : <p className="hint">Nothing waiting. 🎉 To request money, open a gallery and use its <b>Payment &amp; email</b> tab.</p>}
      </section>

      <section className="page-sec">
        <h2>Payment history</h2>
        {paidRows.length ? (
          <div className="list-page">
            {paidRows.slice(0, 40).map((p, i) => (
              <Link key={i} href={`/admin/g/${p.galleryId}#payment`} className="list-row">
                <span className="lr-main">
                  <span className="lr-title" style={{ display: "block" }}>{p.gallery}</span>
                  <span className="lr-sub">{p.event === "Marked paid" ? "Marked paid by you" : "Paid through Stripe"} · {p.time}</span>
                </span>
                <span className="lr-right"><b>{p.detail.split(" · ")[0] || p.event}</b></span>
              </Link>
            ))}
          </div>
        ) : <p className="hint">No payments yet.</p>}
      </section>
    </AdminShell>
  );
}
