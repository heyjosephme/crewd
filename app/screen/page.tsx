"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { ATTENDEES, getDb, toAttendee } from "@/lib/firebase";
import type { Attendee } from "@/lib/types";

const FRESH_MS = 90_000;

export default function ScreenPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [url, setUrl] = useState("");

  // Passive: the screen ONLY listens and re-renders. It never triggers matching.
  useEffect(() => {
    setUrl(window.location.origin);
    const q = query(collection(getDb(), ATTENDEES), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => setAttendees(snap.docs.map((d) => toAttendee(d.id, d.data()))),
      (err) => console.error("[screen] snapshot error:", err),
    );
    return () => unsub();
  }, []);

  const latest = attendees[0];
  const rest = attendees.slice(1, 13);
  const matchedCount = attendees.filter((a) => (a.matches?.length ?? 0) > 0).length;

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#0a0a14] px-6 py-6 text-white lg:px-10 lg:py-8">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-violet-600/25 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/20 blur-[120px]" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-4xl font-black tracking-tight text-transparent lg:text-5xl">
            crewd.
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-sm font-semibold text-red-300">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
            </span>
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-8 text-right">
          <Stat value={attendees.length} label="in the room" />
          <Stat value={matchedCount} label="matched" accent />
        </div>
      </header>

      <div className="relative z-10 mt-6 grid gap-6 lg:grid-cols-3">
        {/* Spotlight + feed */}
        <section className="space-y-6 lg:col-span-2">
          <Spotlight latest={latest} />
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/40">
              In the room
            </h2>
            {rest.length === 0 ? (
              <p className="text-white/40">More builders will appear here as they join…</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {rest.map((a) => (
                  <RosterCard key={a.id} a={a} />
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* QR to join */}
        <aside className="lg:col-span-1">
          <div className="sticky top-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur">
            <p className="text-lg font-semibold">Scan to join the crew</p>
            <p className="mt-1 text-sm text-white/50">
              Fill 4 fields, get matched in seconds.
            </p>
            <div className="mx-auto mt-5 w-fit rounded-2xl bg-white p-4 shadow-2xl shadow-violet-900/40">
              {url ? (
                <QRCodeSVG value={url} size={208} bgColor="#ffffff" fgColor="#0a0a14" />
              ) : (
                <div className="size-[208px] animate-pulse rounded bg-zinc-200" />
              )}
            </div>
            {url && (
              <p className="mt-4 break-all font-mono text-xs text-white/40">{url}</p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stat({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className={`text-4xl font-black tabular-nums lg:text-5xl ${accent ? "text-violet-300" : "text-white"}`}
      >
        {value}
      </div>
      <div className="text-xs uppercase tracking-widest text-white/40">{label}</div>
    </div>
  );
}

function Spotlight({ latest }: { latest: Attendee | undefined }) {
  if (!latest) {
    return (
      <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
        <p className="text-2xl font-bold">Waiting for the first builder…</p>
        <p className="mt-2 text-white/50">Scan the code to claim spot #1.</p>
      </div>
    );
  }

  const matches = latest.matches ?? [];
  const fresh = Date.now() - latest.createdAt < FRESH_MS;

  return (
    <div className="animate-rise rounded-3xl border border-violet-400/30 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/5 p-6 shadow-2xl shadow-violet-900/20 lg:p-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">
        {fresh ? "✨ Just joined" : "Latest builder"}
      </p>
      <h1 className="mt-1 text-4xl font-black tracking-tight lg:text-5xl">
        {latest.name}
      </h1>
      <p className="mt-2 line-clamp-2 max-w-2xl text-lg text-white/60">
        {latest.building}
      </p>

      <div className="mt-6">
        {matches.length > 0 ? (
          <>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/40">
              Top matches
            </p>
            <ul className="space-y-2.5">
              {matches.map((m, i) => (
                <li
                  key={m.id || `${m.name}-${i}`}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-500 text-sm font-bold">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="font-semibold">{m.name}</span>
                    <span className="text-white/60"> — {m.reason}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : fresh ? (
          <p className="animate-pulse text-lg font-medium text-violet-300">
            Matching with the room…
          </p>
        ) : (
          <p className="text-white/50">In the room and ready to team up.</p>
        )}
      </div>
    </div>
  );
}

function RosterCard({ a }: { a: Attendee }) {
  const matched = (a.matches?.length ?? 0) > 0;
  return (
    <li className="animate-rise rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-semibold">{a.name}</p>
        {matched && (
          <span className="shrink-0 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-300">
            matched
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-white/50">{a.building}</p>
    </li>
  );
}
