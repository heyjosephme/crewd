"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { ArrowLeft, Loader2, Sparkles, Tv } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ATTENDEES, getDb, toAttendee } from "@/lib/firebase";
import type { Attendee } from "@/lib/types";

export default function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [loaded, setLoaded] = useState(false);

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
            crewd<span className="text-primary">.</span>
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
        ) : matches.length === 0 ? (
          <CenteredSpinner label="Finding your crew…" sub="Asking Gemini who you should team up with." />
        ) : (
          <>
            <header className="mb-6">
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
            </header>

            <ol className="space-y-4">
              {matches.map((m, i) => (
                <li
                  key={m.id || `${m.name}-${i}`}
                  className="rounded-2xl border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold leading-tight">{m.name}</p>
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

            <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-dashed bg-card/60 p-4 text-center text-sm text-muted-foreground">
              <Tv className="size-4 text-primary" />
              You&apos;re live on the{" "}
              <Link href="/screen" className="font-medium text-primary hover:underline">
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

function CenteredSpinner({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-12 text-center shadow-sm">
      <Loader2 className="size-8 animate-spin text-primary" />
      <p className="font-medium">{label}</p>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}
