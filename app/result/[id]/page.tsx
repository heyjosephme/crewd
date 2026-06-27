"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { ArrowLeft, Loader2, Sparkles, Tv, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ATTENDEES, getDb, toAttendee } from "@/lib/firebase";
import { DEFAULT_AVATAR, roleMeta } from "@/lib/profile";
import { createRoom } from "@/lib/rooms";
import type { Attendee } from "@/lib/types";

export default function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(getDb(), ATTENDEES, id),
      (snap) => {
        setLoaded(true);
        setAttendee(snap.exists() ? toAttendee(snap.id, snap.data()) : null);
      },
      (err) => {
        console.error("[result] snapshot error:", err);
        setLoaded(true);
      },
    );
    return () => unsub();
  }, [id]);

  // The attendee is created instantly on submit (no AI wait). Kick off the Gemini
  // match exactly once, when we first see an unmatched attendee; results stream in
  // via the snapshot above. The route is idempotent, so revisits won't re-run it.
  const matchRequested = useRef(false);
  useEffect(() => {
    if (!attendee || attendee.matchedAt || matchRequested.current) return;
    matchRequested.current = true;
    fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: attendee.id }),
    }).catch((err) => console.error("[result] match trigger failed:", err));
  }, [attendee]);

  async function startRoom() {
    if (!attendee) return;
    setCreatingRoom(true);
    try {
      const roomId = await createRoom({
        name: `${attendee.name.split(" ")[0]}'s crew`,
        creatorId: attendee.id,
      });
      router.push(`/rooms/${roomId}`);
    } catch (err) {
      console.error("[result] create room failed:", err);
      setCreatingRoom(false);
    }
  }

  const matches = attendee?.matches ?? [];

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden bg-gradient-to-b from-background to-accent/40 px-5 py-10">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

      <div className="z-10 w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <span className="text-lg font-bold tracking-tight">
            Crewd<span className="text-primary">.</span>
          </span>
        </div>

        {!loaded ? (
          <CenteredSpinner label="Loading your profile…" />
        ) : !attendee ? (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
            <p className="font-medium">We couldn&apos;t find that profile.</p>
            <Link
              href="/"
              className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
            >
              Start over →
            </Link>
          </div>
        ) : !attendee.matchedAt ? (
          <CenteredSpinner
            label="Finding your crew…"
            sub="Asking Gemini who you should team up with."
          />
        ) : (
          <>
            <header className="mb-6">
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="flex size-12 items-center justify-center rounded-2xl border bg-card text-2xl shadow-sm"
                  aria-hidden
                >
                  {attendee.avatar || DEFAULT_AVATAR}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold leading-tight">
                    {attendee.name}
                  </p>
                  <RoleTag role={attendee.role} className="mt-1" />
                </div>
              </div>
              {matches.length > 0 ? (
                <>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <Sparkles className="size-3.5" />
                    Your top {matches.length} matches
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    Hey {attendee.name.split(" ")[0]}, meet your crew.
                  </h1>
                  <p className="mt-1 text-muted-foreground">
                    The people in the room you should team up with right now.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-3xl font-bold tracking-tight">
                    Hey {attendee.name.split(" ")[0]}, you&apos;re early!
                  </h1>
                  <p className="mt-1 text-muted-foreground">
                    No matches yet — they&apos;ll appear here as more builders join.
                  </p>
                </>
              )}
            </header>

            <ol className="space-y-4">
              {matches.map((m, i) => (
                <li
                  key={m.id || `${m.name}-${i}`}
                  className="rounded-2xl border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl border bg-background text-2xl shadow-sm"
                      aria-hidden
                    >
                      {m.avatar || DEFAULT_AVATAR}
                      <span className="absolute -left-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                        {i + 1}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-lg font-semibold leading-tight">
                          {m.name}
                        </p>
                        <RoleTag role={m.role} />
                      </div>
                      {m.building && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                          Building: {m.building}
                        </p>
                      )}
                      <p className="mt-3 rounded-lg bg-accent/60 p-3 text-sm leading-relaxed text-accent-foreground">
                        {m.reason}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <Button
              onClick={startRoom}
              disabled={creatingRoom}
              size="lg"
              className="mt-6 w-full"
            >
              {creatingRoom ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  <Users />
                  Start a room with your crew
                </>
              )}
            </Button>

            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed bg-card/60 p-4 text-center text-sm text-muted-foreground">
              <Tv className="size-4 text-primary" />
              You&apos;re live on the{" "}
              <Link
                href="/screen"
                className="font-medium text-primary hover:underline"
              >
                big screen
              </Link>
              .
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// A small role pill (emoji + label). Renders nothing for unknown/empty roles so
// older docs without a role degrade gracefully.
function RoleTag({ role, className }: { role?: string; className?: string }) {
  const meta = roleMeta(role);
  if (!meta) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground ${className ?? ""}`}
    >
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </span>
  );
}

function CenteredSpinner({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-12 text-center shadow-sm">
      <Loader2 className="size-8 animate-spin text-primary" />
      <p className="font-medium">{label}</p>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}
