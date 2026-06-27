"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { ATTENDEES, getDb, toAttendee } from "@/lib/firebase";
import { DEFAULT_AVATAR, roleMeta } from "@/lib/profile";
import type { Attendee } from "@/lib/types";

const FRESH_MS = 90_000;

// Celebratory confetti burst when a just-joined person's matches land. Imported
// dynamically so it only ever loads in the browser (never during SSR), and wrapped
// so a confetti hiccup can never break the live screen.
async function celebrate() {
  try {
    const confetti = (await import("canvas-confetti")).default;
    const base = {
      spread: 78,
      startVelocity: 42,
      ticks: 220,
      zIndex: 60,
      colors: ["#a78bfa", "#c4b5fd", "#e879f9", "#f0abfc", "#ffffff"],
    };
    confetti({ ...base, particleCount: 90, origin: { x: 0.25, y: 0.45 } });
    confetti({ ...base, particleCount: 90, origin: { x: 0.55, y: 0.45 } });
  } catch {
    /* non-essential — ignore */
  }
}

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
    <main className="relative h-screen w-full overflow-hidden bg-[#070710] px-6 py-6 text-white lg:px-12 lg:py-9">
      <AmbientBackground />

      <div className="relative z-10 mx-auto flex h-full max-w-[1600px] flex-col">
        <header className="flex items-center justify-between">
          <div className="flex items-baseline gap-4">
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-violet-400 bg-clip-text text-5xl font-black tracking-tight text-transparent lg:text-6xl">
              Crewd.
            </span>
            <LivePill />
          </div>
          <div className="flex items-center gap-10">
            <Stat value={attendees.length} label="in the room" />
            <Stat value={matchedCount} label="matched" accent />
          </div>
        </header>

        <div className="mt-8 grid min-h-0 flex-1 gap-7 lg:grid-cols-3">
          <section className="flex min-h-0 flex-col gap-7 overflow-y-auto lg:col-span-2">
            <Spotlight latest={latest} />
            <Roster rest={rest} />
          </section>
          <JoinPanel url={url} />
        </div>
      </div>
    </main>
  );
}

/* ---------------------------------- chrome --------------------------------- */

function AmbientBackground() {
  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-48 -top-48 h-[34rem] w-[34rem] rounded-full bg-violet-600/30 blur-[130px]"
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{
          duration: 18,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 -right-32 h-[34rem] w-[34rem] rounded-full bg-fuchsia-600/25 blur-[130px]"
        animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
        transition={{
          duration: 22,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,#070710_100%)]" />
    </>
  );
}

function LivePill() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3.5 py-1.5 text-sm font-semibold text-red-300 backdrop-blur">
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
      </span>
      LIVE
    </span>
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
    <div className="text-right">
      <AnimatedNumber
        value={value}
        className={`block text-5xl font-black tabular-nums lg:text-6xl ${
          accent
            ? "bg-gradient-to-br from-violet-300 to-fuchsia-300 bg-clip-text text-transparent"
            : "text-white"
        }`}
      />
      <div className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-white/40">
        {label}
      </div>
    </div>
  );
}

// Spring-counts to the new value whenever it changes — makes joins feel alive.
function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => Math.round(v).toString());
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.7, ease: "easeOut" });
    return () => controls.stop();
  }, [value, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}

/* --------------------------------- spotlight ------------------------------- */

function Spotlight({ latest }: { latest: Attendee | undefined }) {
  return (
    <div className="relative min-h-[20rem] shrink-0">
      <AnimatePresence mode="wait">
        {!latest ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-full min-h-[20rem] flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.04] p-10 text-center backdrop-blur-xl"
          >
            <p className="text-3xl font-bold">Waiting for the first builder…</p>
            <p className="mt-2 text-white/50">Scan the code to claim spot #1.</p>
          </motion.div>
        ) : (
          <SpotlightCard key={latest.id} a={latest} />
        )}
      </AnimatePresence>
    </div>
  );
}

function SpotlightCard({ a }: { a: Attendee }) {
  const matches = a.matches ?? [];
  const fresh = Date.now() - a.createdAt < FRESH_MS;

  // Fire confetti once when a just-joined arrival's matches appear on the spotlight.
  const celebrated = useRef(false);
  useEffect(() => {
    if (fresh && matches.length > 0 && !celebrated.current) {
      celebrated.current = true;
      void celebrate();
    }
  }, [fresh, matches.length]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -12 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="relative overflow-hidden rounded-[2rem] border border-violet-300/20 bg-gradient-to-br from-white/[0.1] to-white/[0.03] p-7 shadow-[0_10px_70px_-15px_rgba(124,58,237,0.55)] backdrop-blur-xl lg:p-9"
    >
      {/* glossy top highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">
        {fresh ? "✨ Just joined" : "Latest builder"}
      </p>

      <div className="mt-3 flex items-center gap-5">
        <motion.div
          initial={fresh ? { scale: 0.6, rotate: -12 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="flex size-20 shrink-0 items-center justify-center rounded-3xl border border-white/15 bg-white/10 text-5xl shadow-inner lg:size-24 lg:text-6xl"
          aria-hidden
        >
          {a.avatar || DEFAULT_AVATAR}
        </motion.div>
        <div className="min-w-0">
          <h1 className="truncate text-5xl font-black tracking-tight lg:text-6xl">
            {a.name}
          </h1>
          <ScreenRoleTag role={a.role} className="mt-2.5" />
        </div>
      </div>

      {a.building && (
        <p className="mt-4 line-clamp-2 max-w-3xl text-lg text-white/55">
          {a.building}
        </p>
      )}

      <div className="mt-7">
        <AnimatePresence mode="wait">
          {matches.length > 0 ? (
            <motion.div
              key="matches"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-white/40">
                Top matches
              </p>
              <motion.ul
                className="space-y-3"
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.1 } } }}
              >
                {matches.map((m, i) => (
                  <motion.li
                    key={m.id || `${m.name}-${i}`}
                    variants={{
                      hidden: { opacity: 0, x: -16 },
                      show: { opacity: 1, x: 0 },
                    }}
                    transition={{ type: "spring", stiffness: 320, damping: 26 }}
                    className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur"
                  >
                    <span
                      className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-2xl"
                      aria-hidden
                    >
                      {m.avatar || DEFAULT_AVATAR}
                      <span className="absolute -left-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 text-[11px] font-bold">
                        {i + 1}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <span className="text-lg font-semibold">{m.name}</span>
                      <span className="text-white/55"> — {m.reason}</span>
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
            </motion.div>
          ) : fresh ? (
            <motion.p
              key="matching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-lg font-medium text-violet-300"
            >
              Matching with the room
              <MatchingDots />
            </motion.p>
          ) : (
            <motion.p
              key="ready"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-white/50"
            >
              In the room and ready to team up.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function MatchingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-violet-300"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{
            duration: 1,
            repeat: Number.POSITIVE_INFINITY,
            delay: i * 0.15,
          }}
        />
      ))}
    </span>
  );
}

/* ---------------------------------- roster --------------------------------- */

function Roster({ rest }: { rest: Attendee[] }) {
  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-white/40">
        In the room
      </h2>
      {rest.length === 0 ? (
        <p className="text-white/40">More builders will appear here as they join…</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence>
            {rest.map((a) => (
              <motion.li
                key={a.id}
                layout
                initial={{ opacity: 0, scale: 0.9, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-xl"
                    aria-hidden
                  >
                    {a.avatar || DEFAULT_AVATAR}
                  </span>
                  <p className="min-w-0 flex-1 truncate font-semibold">{a.name}</p>
                  {(a.matches?.length ?? 0) > 0 && (
                    <span className="shrink-0 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-300">
                      matched
                    </span>
                  )}
                </div>
                {a.building ? (
                  <p className="mt-2 line-clamp-2 text-sm text-white/50">
                    {a.building}
                  </p>
                ) : (
                  <ScreenRoleTag role={a.role} className="mt-2.5" />
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

/* --------------------------------- join QR --------------------------------- */

function JoinPanel({ url }: { url: string }) {
  return (
    <aside className="lg:col-span-1">
      <div className="sticky top-6 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.1] to-white/[0.03] p-7 text-center shadow-[0_10px_70px_-15px_rgba(217,70,239,0.45)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <p className="text-xl font-bold">Scan to join the crew</p>
        <p className="mt-1.5 text-sm text-white/50">
          Pick your vibe, get matched in seconds.
        </p>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-6 w-fit rounded-3xl bg-white p-5 shadow-2xl"
        >
          {url ? (
            <QRCodeSVG value={url} size={232} bgColor="#ffffff" fgColor="#070710" />
          ) : (
            <div className="size-[232px] animate-pulse rounded bg-zinc-200" />
          )}
        </motion.div>
        {url && (
          <p className="mt-4 break-all font-mono text-xs text-white/40">{url}</p>
        )}
      </div>
    </aside>
  );
}

/* ---------------------------------- shared --------------------------------- */

// Role pill tuned for the dark big-screen theme. Renders nothing for unknown roles.
function ScreenRoleTag({ role, className }: { role?: string; className?: string }) {
  const meta = roleMeta(role);
  if (!meta) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm font-medium text-white/75 ${className ?? ""}`}
    >
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </span>
  );
}
