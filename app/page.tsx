"use client";

import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProfileInput } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [form, setForm] = useState<ProfileInput>({
    name: "",
    building: "",
    skills: "",
    lookingFor: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ProfileInput>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmed: ProfileInput = {
      name: form.name.trim(),
      building: form.building.trim(),
      skills: form.skills.trim(),
      lookingFor: form.lookingFor.trim(),
    };
    if (!trimmed.name || !trimmed.building || !trimmed.skills || !trimmed.lookingFor) {
      setError("Please fill in all four fields.");
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
      if (!res.ok || !data.id) throw new Error(data.error ?? "Something went wrong.");
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
            crewd<span className="text-primary">.</span>
          </h1>
          <p className="mt-2 text-balance text-muted-foreground">
            Fill 4 fields in ~30 seconds and get matched with the best teammates in the
            room — right now.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-2xl border bg-card p-6 shadow-xl shadow-primary/5"
        >
          <Field
            id="name"
            label="Your name"
            hint="So your matches can find you."
          >
            <Input
              id="name"
              value={form.name}
              onChange={set("name")}
              placeholder="Ada Lovelace"
              autoComplete="name"
              disabled={loading}
            />
          </Field>

          <Field
            id="building"
            label="What do you want to build?"
            hint="Your idea or direction."
          >
            <Textarea
              id="building"
              value={form.building}
              onChange={set("building")}
              placeholder="A real-time tool that turns event check-in queues into instant team matches."
              rows={2}
              disabled={loading}
            />
          </Field>

          <Field id="skills" label="What do you bring?" hint="Your skills & strengths.">
            <Textarea
              id="skills"
              value={form.skills}
              onChange={set("skills")}
              placeholder="Frontend (React/Next.js), UI design, live demos."
              rows={2}
              disabled={loading}
            />
          </Field>

          <Field
            id="lookingFor"
            label="Who are you looking for?"
            hint="Your ideal teammate."
          >
            <Textarea
              id="lookingFor"
              value={form.lookingFor}
              onChange={set("lookingFor")}
              placeholder="A backend/ML engineer and someone who loves pitching."
              rows={2}
              disabled={loading}
            />
          </Field>

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
          <Link href="/screen" className="font-medium text-primary hover:underline">
            Open the live view →
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
