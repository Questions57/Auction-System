"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Auction = {
  id: string;
  title: string;
  description?: string;
  startsAt: string;
  revealAt: string;
  endsAt: string;
  status: "SCHEDULED" | "COMMITTING" | "REVEALING" | "CLOSED";
  hasCurrentUserCommitment: boolean;
  winner?: { bidderName: string; amountCents: number };
};

type AuctionDetail = Auction & {
  bids: {
    id: string;
    bidderName?: string;
    commitmentHash?: string;
    committedAt: string;
    revealedAt?: string;
    amountCents?: number | null;
  }[];
};

const demoUser = { id: "demo-bidder", role: "BIDDER" };
type Toast = { kind: "success" | "error" | "info"; message: string };

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function Home() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [selected, setSelected] = useState<Auction | null>(null);
  const [auctionDetail, setAuctionDetail] = useState<AuctionDetail | null>(null);
  const [amount, setAmount] = useState("");
  const [revealAmount, setRevealAmount] = useState("");
  const [revealNonce, setRevealNonce] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [role, setRole] = useState<"BIDDER" | "ADMIN">("BIDDER");
  const [schedule, setSchedule] = useState({ title: "", startsAt: "", revealAt: "", endsAt: "" });
  const [hasRevealCredentials, setHasRevealCredentials] = useState(false);

  const headers = useMemo(
    () => ({ "Content-Type": "application/json", "x-user-id": role === "ADMIN" ? "demo-admin" : demoUser.id, "x-user-role": role }),
    [role],
  );

  async function loadAuctions() {
    try {
      const response = await fetch(`${API_URL}/auctions`, { headers });
      if (!response.ok) throw new Error("The auction service is unavailable.");
      const data = await response.json();
      setAuctions(data);
      setSelected((current) => data.find((auction: Auction) => auction.id === current?.id) ?? data[0] ?? null);
      if (!data.length) setToast({ kind: "info", message: "No auctions have been scheduled yet." });
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to load auctions." });
    }
  }

  useEffect(() => {
    void loadAuctions();
  }, [role]);

  useEffect(() => {
    async function loadAuctionDetail() {
      if (!selected) {
        setAuctionDetail(null);
        return;
      }
      try {
        const response = await fetch(`${API_URL}/auctions/${selected.id}`, { headers });
        if (!response.ok) throw new Error("Unable to load auction detail.");
        setAuctionDetail(await response.json());
      } catch (error) {
        setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to load auction detail." });
      }
    }
    void loadAuctionDetail();
  }, [selected?.id, role, headers]);

  useEffect(() => {
    const saved = selected && localStorage.getItem(`auction-nonce:${selected.id}`);
    if (!saved) {
      setHasRevealCredentials(false);
      setRevealAmount("");
      setRevealNonce("");
      return;
    }
    const { amountCents, nonce } = JSON.parse(saved) as { amountCents: number; nonce: string };
    setHasRevealCredentials(true);
    setRevealAmount((amountCents / 100).toFixed(2));
    setRevealNonce(nonce);
  }, [selected?.id]);

  useEffect(() => {
    if (!toast || toast.kind === "error") return;
    const timeout = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function createAuction(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/auctions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: schedule.title,
          startsAt: new Date(schedule.startsAt).toISOString(),
          revealAt: new Date(schedule.revealAt).toISOString(),
          endsAt: new Date(schedule.endsAt).toISOString(),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Could not schedule this auction.");
      setSchedule({ title: "", startsAt: "", revealAt: "", endsAt: "" });
      setToast({ kind: "success", message: "Auction scheduled successfully." });
      await loadAuctions();
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to schedule auction." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitBid(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setIsSubmitting(true);
    try {
      if (selected.status === "COMMITTING") {
        const amountCents = Math.round(Number(amount) * 100);
        if (!Number.isSafeInteger(amountCents) || amountCents < 1) {
          setToast({ kind: "error", message: "Enter a valid bid amount in US dollars." });
          return;
        }
        const replacing = selected.hasCurrentUserCommitment;
        setToast({ kind: "info", message: replacing ? "Replacing your sealed offer…" : "Creating your sealed offer…" });
        const nonce = crypto.randomUUID();
        const commitmentHash = await sha256(`${selected.id}:${demoUser.id}:${amountCents}:${nonce}`);
        const response = await fetch(`${API_URL}/auctions/${selected.id}/commitments`, {
          method: "POST", headers, body: JSON.stringify({ commitmentHash }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? "Could not submit your sealed bid.");
        localStorage.setItem(`auction-nonce:${selected.id}`, JSON.stringify({ nonce, amountCents }));
        setHasRevealCredentials(true);
        setToast({
          kind: "success",
          message: replacing
            ? "Sealed offer replaced successfully. This browser now holds the credentials required to reveal it."
            : "Sealed offer committed successfully. This browser holds the credentials required to reveal it.",
        });
      } else if (selected.status === "REVEALING") {
        const amountCents = Math.round(Number(revealAmount) * 100);
        if (!Number.isSafeInteger(amountCents) || amountCents < 1 || !revealNonce.trim()) {
          setToast({ kind: "error", message: "Enter the original offer and reveal nonce for Maya Chen’s commitment." });
          return;
        }
        setToast({ kind: "info", message: "Verifying Maya Chen’s saved amount and nonce against the auction commitment…" });
        const response = await fetch(`${API_URL}/auctions/${selected.id}/reveal`, {
          method: "POST", headers, body: JSON.stringify({ nonce: revealNonce.trim(), amountCents }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? "Could not reveal your bid.");
        setToast({ kind: "success", message: "Maya Chen’s offer was verified and revealed. It will be considered when the auction closes." });
        setRevealNonce("");
      }
      setAmount("");
      await loadAuctions();
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to submit bid." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">NORTHSTAR AUCTION HOUSE</p>
          <h1>Bid with conviction.<br />Reveal with confidence.</h1>
        </div>
        <div className="identity"><span className="live-dot" /> Signed in as {role === "ADMIN" ? "Elena Rossi, Administrator" : "Maya Chen"}</div>
      </header>

      <section className="intro">
        <div><p className="eyebrow">CURRENT CATALOGUE</p><h2>Quietly competitive.</h2></div>
        <p>Every offer stays encrypted until the reveal window. The highest verified bid wins.</p>
      </section>

      {toast && <div className={`toast ${toast.kind}`} role="status"><span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToast(null)}>×</button></div>}
      <div className="mode-switch">
        <span>Demo view</span>
        <button className={role === "BIDDER" ? "active" : ""} onClick={() => setRole("BIDDER")}>Bidder</button>
        <button className={role === "ADMIN" ? "active" : ""} onClick={() => setRole("ADMIN")}>Administrator</button>
      </div>
      {role === "ADMIN" && (
        <>
          <form className="schedule-form" onSubmit={createAuction}>
            <div><p className="eyebrow">ADMINISTRATION</p><h3>Schedule an auction</h3></div>
            <input aria-label="Auction title" value={schedule.title} onChange={(event) => setSchedule({ ...schedule, title: event.target.value })} placeholder="Auction title" required />
            <input aria-label="Commitment start" type="datetime-local" value={schedule.startsAt} onChange={(event) => setSchedule({ ...schedule, startsAt: event.target.value })} required />
            <input aria-label="Reveal start" type="datetime-local" value={schedule.revealAt} onChange={(event) => setSchedule({ ...schedule, revealAt: event.target.value })} required />
            <input aria-label="Auction end" type="datetime-local" value={schedule.endsAt} onChange={(event) => setSchedule({ ...schedule, endsAt: event.target.value })} required />
            <button disabled={isSubmitting}>{isSubmitting ? "Scheduling..." : "Schedule"}</button>
          </form>
          {auctionDetail && (
            <section className="admin-panel" aria-label="Selected auction bid audit">
              <div className="admin-panel-title">
                <div><p className="eyebrow">BID AUDIT</p><h3>{auctionDetail.title}</h3></div>
                <span>{auctionDetail.bids.length} commitment{auctionDetail.bids.length === 1 ? "" : "s"}</span>
              </div>
              {auctionDetail.bids.length ? (
                <div className="bid-table-wrap">
                  <table>
                    <thead><tr><th>Bidder</th><th>Committed</th><th>Reveal</th><th>Amount</th><th>Commitment</th></tr></thead>
                    <tbody>
                      {auctionDetail.bids.map((bid) => (
                        <tr key={bid.id}>
                          <td>{bid.bidderName}</td>
                          <td>{new Date(bid.committedAt).toLocaleString()}</td>
                          <td>{bid.revealedAt ? new Date(bid.revealedAt).toLocaleString() : "Pending"}</td>
                          <td>{bid.amountCents === null || bid.amountCents === undefined ? "Sealed" : money(bid.amountCents)}</td>
                          <td><code>{bid.commitmentHash?.slice(0, 12)}...</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="empty-audit">No commitments have been submitted for this auction.</p>}
            </section>
          )}
        </>
      )}
      <section className="layout">
        <aside className="auction-list" aria-label="Auctions">
          {auctions.map((auction) => (
            <button className={`auction-card ${auction.id === selected?.id ? "selected" : ""}`} key={auction.id} onClick={() => setSelected(auction)}>
              <span className={`status ${auction.status.toLowerCase()}`}>{auction.status}</span>
              <strong>{auction.title}</strong>
              {auction.winner ? (
                <small className="card-winner">Won by {auction.winner.bidderName} · {money(auction.winner.amountCents)}</small>
              ) : (
                <small>Ends {new Date(auction.endsAt).toLocaleString()}</small>
              )}
            </button>
          ))}
        </aside>

        {selected && (
          <article className="detail">
            <div className="detail-top">
              <div><span className={`status ${selected.status.toLowerCase()}`}>{selected.status}</span><h2>{selected.title}</h2></div>
            </div>
            <p className="description">{selected.description || "A carefully selected lot from the Northstar collection."}</p>
            {selected.status === "CLOSED" && (
              <section className="outcome" aria-label="Auction outcome">
                <p className="eyebrow">AUCTION COMPLETE</p>
                {selected.winner ? (
                  <>
                    <h3>{selected.winner.bidderName} placed the winning offer.</h3>
                    <p className="outcome-price">{money(selected.winner.amountCents)}</p>
                    <p>The highest valid revealed offer won. Any tied offer would be resolved by its earlier commitment time.</p>
                  </>
                ) : (
                  <>
                    <h3>This lot received no valid revealed offers.</h3>
                    <p>The auction has closed without a winner.</p>
                  </>
                )}
              </section>
            )}
            <dl className="timeline">
              <div><dt>Commitment opens</dt><dd>{new Date(selected.startsAt).toLocaleString()}</dd></div>
              <div><dt>Reveal begins</dt><dd>{new Date(selected.revealAt).toLocaleString()}</dd></div>
              <div><dt>Auction closes</dt><dd>{new Date(selected.endsAt).toLocaleString()}</dd></div>
            </dl>
            {role === "BIDDER" && (selected.status === "COMMITTING" || (selected.status === "REVEALING" && selected.hasCurrentUserCommitment)) && (
              <form onSubmit={submitBid} className="bid-form">
                {selected.status === "COMMITTING" ? (
                  <>
                    <label htmlFor="amount">Your sealed offer (USD)</label>
                    <input id="amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required />
                    <p>
                      {selected.hasCurrentUserCommitment
                        ? "You already have a sealed offer. Submitting again safely replaces it until the reveal period begins."
                        : "Your amount and a private random nonce are hashed in your browser. Only the hash is sent now."}
                    </p>
                    <button disabled={isSubmitting}>
                      {isSubmitting ? "Saving..." : selected.hasCurrentUserCommitment ? "Replace sealed bid" : "Commit sealed bid"}
                    </button>
                  </>
                ) : (
                  <>
                    <h3>Reveal your offer</h3>
                    <p>You are viewing as Maya Chen. Reveal the original offer and private nonce; the API verifies both against Maya Chen’s commitment.</p>
                    <label htmlFor="reveal-amount">Original offer (USD)</label>
                    <input id="reveal-amount" type="number" min="0.01" step="0.01" value={revealAmount} onChange={(event) => setRevealAmount(event.target.value)} placeholder="0.00" required />
                    <label htmlFor="reveal-nonce">Private reveal nonce</label>
                    <input id="reveal-nonce" value={revealNonce} onChange={(event) => setRevealNonce(event.target.value)} placeholder="Paste the nonce saved at commitment time" required />
                    {!hasRevealCredentials && <p className="credential-warning">This browser has no saved credentials. Enter the original offer and nonce from your secure record to reveal this bid.</p>}
                    <button disabled={isSubmitting}>{isSubmitting ? "Verifying..." : "Reveal Maya Chen’s bid"}</button>
                  </>
                )}
              </form>
            )}
            {role === "BIDDER" && selected.status === "REVEALING" && !selected.hasCurrentUserCommitment && (
              <p className="admin-read-only">Maya Chen did not commit an offer for this auction, so there is no bid available to reveal.</p>
            )}
            {role === "ADMIN" && (selected.status === "COMMITTING" || selected.status === "REVEALING") && (
              <p className="admin-read-only">Administrator view is read-only. Bid actions are available only to authorized bidders.</p>
            )}
          </article>
        )}
      </section>
    </main>
  );
}
