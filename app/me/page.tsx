"use client";

import { ArrowRight, UserRound } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { useMe } from "@/lib/identity";
import { DEFAULT_AVATAR, roleMeta } from "@/lib/profile";
import { cn } from "@/lib/utils";

export default function MePage() {
  const me = useMe();

  // Identity is provisioned on first load (AppShell); show a light placeholder until
  // the client effect populates it.
  if (!me) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <UserRound className="size-6 animate-pulse text-muted-foreground" />
      </main>
    );
  }

  // A role is only saved once you've completed Find — so it doubles as "has a real
  // attendee doc + matches to view".
  const role = roleMeta(me.role);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
      <header className="mb-7 flex flex-col items-center text-center">
        <div className="flex size-24 items-center justify-center rounded-3xl border bg-card text-5xl shadow-sm">
          <span aria-hidden>{me.avatar || DEFAULT_AVATAR}</span>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{me.name}</h1>
        {role ? (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium text-muted-foreground">
            <span aria-hidden>{role.emoji}</span>
            {role.label}
          </span>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Pick a role in Find to get matched.
          </p>
        )}
      </header>

      <div className="space-y-3">
        {role ? (
          <>
            <Link
              href={`/result/${me.id}`}
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              View my matches
              <ArrowRight />
            </Link>
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full",
              )}
            >
              Update my profile
            </Link>
          </>
        ) : (
          <Link
            href="/"
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
          >
            Find my crew
            <ArrowRight />
          </Link>
        )}
        <Link
          href="/rooms"
          className="block pt-1 text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Browse rooms →
        </Link>
      </div>
    </main>
  );
}
