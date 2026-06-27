"use client";

import {
  ArrowRight,
  Check,
  ChevronRight,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AVATARS,
  DEFAULT_AVATAR,
  ROLES,
  randomAvatar,
  randomName,
} from "@/lib/profile";
import type { ProfileInput } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Home() {
  const router = useRouter();
  const [form, setForm] = useState<ProfileInput>({
    name: "",
    avatar: DEFAULT_AVATAR,
    role: "",
    building: "",
    skills: "",
    lookingFor: "",
  });
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hand every arrival a fun identity on mount. Done client-side (not in the initial
  // state) so server and client render the same thing — no hydration mismatch.
  useEffect(() => {
    setForm((f) => ({ ...f, name: randomName(), avatar: randomAvatar() }));
  }, []);

  function update<K extends keyof ProfileInput>(
    key: K,
    value: ProfileInput[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setText(key: "name" | "building" | "skills" | "lookingFor") {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      update(key, e.target.value);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmed: ProfileInput = {
      name: form.name.trim(),
      avatar: form.avatar,
      role: form.role,
      building: form.building.trim(),
      skills: form.skills.trim(),
      lookingFor: form.lookingFor.trim(),
    };
    if (!trimmed.name) {
      setError("Add a name — or tap the shuffle to generate one.");
      return;
    }
    if (!trimmed.role) {
      setError("Pick a role so we know your vibe.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trimmed),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id)
        throw new Error(data.error ?? "Something went wrong.");
      router.push(`/result/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-background to-accent/40 px-5 py-10">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

      <div className="z-10 w-full max-w-md">
        <header className="mb-7 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" />
            Live at the hackathon
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            Crewd<span className="text-primary">.</span>
          </h1>
          <p className="mt-2 text-balance text-muted-foreground">
            Pick a vibe and a role — get matched with the best teammates in the
            room in seconds.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="space-y-6 rounded-2xl border bg-card p-6 shadow-xl shadow-primary/5"
        >
          {/* Identity: emoji avatar (Notion-style page icon) + a re-rollable name. */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setAvatarOpen((o) => !o)}
                disabled={loading}
                aria-label="Pick your avatar"
                aria-expanded={avatarOpen}
                className="flex size-20 items-center justify-center rounded-2xl border bg-background text-4xl shadow-sm transition hover:bg-accent disabled:opacity-50"
              >
                <span aria-hidden>{form.avatar}</span>
                <span className="absolute -bottom-1.5 -right-1.5 flex size-7 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm">
                  <Pencil className="size-3.5" />
                </span>
              </button>

              {avatarOpen && (
                <>
                  {/* Click-away backdrop. */}
                  <button
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                    onClick={() => setAvatarOpen(false)}
                    className="fixed inset-0 z-10 cursor-default"
                  />
                  <div className="absolute left-1/2 top-full z-20 mt-3 w-72 -translate-x-1/2 rounded-2xl border bg-popover p-3 shadow-xl">
                    <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
                      Choose an avatar
                    </p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {AVATARS.map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => {
                            update("avatar", a);
                            setAvatarOpen(false);
                          }}
                          aria-label={`Avatar ${a}`}
                          className={cn(
                            "flex aspect-square items-center justify-center rounded-xl text-2xl transition hover:bg-accent",
                            a === form.avatar &&
                              "bg-accent ring-2 ring-primary",
                          )}
                        >
                          <span aria-hidden>{a}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative w-full">
              <Input
                value={form.name}
                onChange={setText("name")}
                placeholder="Your name"
                aria-label="Your name"
                autoComplete="off"
                disabled={loading}
                className="h-12 pr-12 text-center text-lg font-medium"
              />
              <button
                type="button"
                onClick={() => update("name", randomName())}
                disabled={loading}
                title="Generate a name"
                aria-label="Generate a random name"
                className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className="size-4" />
              </button>
            </div>
          </div>

          {/* Role: the one required pick beyond a name. */}
          <fieldset className="space-y-2" disabled={loading}>
            <legend className="mb-2 text-sm font-medium">Pick your role</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {ROLES.map((r) => {
                const active = form.role === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => update("role", r.key)}
                    aria-pressed={active}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition hover:bg-accent disabled:opacity-50",
                      active &&
                        "border-primary bg-primary/10 ring-1 ring-primary hover:bg-primary/10",
                    )}
                  >
                    <span className="text-2xl leading-none" aria-hidden>
                      {r.emoji}
                    </span>
                    <span className="text-xs font-medium">{r.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Everything else is optional context — collapsed by default, Notion-style. */}
          <div className="space-y-2">
            <Collapsible
              label="What do you want to build?"
              hint="Your idea or direction."
              filled={form.building.trim().length > 0}
            >
              <Textarea
                value={form.building}
                onChange={setText("building")}
                placeholder="A real-time tool that turns event check-in queues into instant team matches."
                rows={2}
                disabled={loading}
              />
            </Collapsible>

            <Collapsible
              label="What do you bring?"
              hint="Your skills & strengths."
              filled={form.skills.trim().length > 0}
            >
              <Textarea
                value={form.skills}
                onChange={setText("skills")}
                placeholder="Frontend (React/Next.js), UI design, live demos."
                rows={2}
                disabled={loading}
              />
            </Collapsible>

            <Collapsible
              label="Who are you looking for?"
              hint="Your ideal teammate."
              filled={form.lookingFor.trim().length > 0}
            >
              <Textarea
                value={form.lookingFor}
                onChange={setText("lookingFor")}
                placeholder="A backend/ML engineer and someone who loves pitching."
                rows={2}
                disabled={loading}
              />
            </Collapsible>
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                Finding your crew…
              </>
            ) : (
              <>
                Find my crew
                <ArrowRight />
              </>
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Running the big screen?{" "}
          <Link
            href="/screen"
            className="font-medium text-primary hover:underline"
          >
            Open the live view →
          </Link>
        </p>
      </div>
    </main>
  );
}

// A Notion-style toggle: collapsed by default, a rotating chevron, and a quiet
// "filled" check so people can see at a glance which optional fields they answered.
function Collapsible({
  label,
  hint,
  filled,
  children,
}: {
  label: string;
  hint: string;
  filled: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-xl border bg-background/40 [&_summary]:list-none">
      <summary className="flex cursor-pointer select-none items-center gap-2 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors hover:bg-accent/50">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        <span className="flex-1">{label}</span>
        {filled ? (
          <Check className="size-4 shrink-0 text-primary" />
        ) : (
          <span className="shrink-0 text-xs font-normal text-muted-foreground">
            Optional
          </span>
        )}
      </summary>
      <div className="px-3.5 pb-3.5 pt-1">
        {children}
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      </div>
    </details>
  );
}
