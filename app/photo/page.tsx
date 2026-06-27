"use client";

import {
  Camera,
  ImagePlus,
  Loader2,
  MapPin,
  Sparkles,
  X as XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type ComponentType,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMe } from "@/lib/identity";
import {
  addClaim,
  type Claim,
  clamp01,
  createPhotoEvent,
  listenClaims,
  listenLatestPhotoEvent,
  type PhotoEvent,
  type Point,
  type SnsKind,
  snsHref,
  uploadGroupPhoto,
} from "@/lib/photo";

// ============================================================================
// "Group Photo" — ISOLATED demo route (/photo).
//
// Flow: upload a group photo -> Gemini Vision detects where people are ->
// tappable markers -> each person SELF-CLAIMS their spot and attaches SNS links
// -> anyone can tap a claimed marker to open those links. No face recognition:
// detection only locates people; identity is attached purely by self-claiming.
//
// Imports only read-only helpers (useMe, lib/photo). Touches no shared files.
// ============================================================================

// A detected (unclaimed) marker is hidden once a claim sits this close to it.
const TAKEN_DIST = 0.05;

// Stable anonymous id for users who haven't done the Find flow yet.
const ANON_KEY = "crewd:photo-anon";
function getAnonId(): string {
  if (typeof window === "undefined") return "anon";
  try {
    let v = window.localStorage.getItem(ANON_KEY);
    if (!v) {
      v = `anon-${crypto.randomUUID()}`;
      window.localStorage.setItem(ANON_KEY, v);
    }
    return v;
  } catch {
    return "anon";
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// --- Inline brand glyphs (lucide v1 dropped brand icons; keep them self-contained) ---

function GithubGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <title>GitHub</title>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23a11.51 11.51 0 0 1 3.003-.404c1.018.005 2.045.138 3.003.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function LinkedinGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <title>LinkedIn</title>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
    </svg>
  );
}

function XGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <title>X</title>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <title>Instagram</title>
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.13 1.38C1.35 2.68.94 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13.67.66 1.34 1.07 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.31 1.46-.72 2.13-1.38.66-.67 1.07-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.31-.79-.72-1.46-1.38-2.13C21.32 1.35 20.65.94 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0z" />
      <path d="M12 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84M12 16a4 4 0 1 1 4-4 4 4 0 0 1-4 4z" />
      <circle cx="18.41" cy="5.59" r="1.44" />
    </svg>
  );
}

const SNS_FIELDS: ReadonlyArray<{
  kind: SnsKind;
  label: string;
  placeholder: string;
  Glyph: ComponentType<{ className?: string }>;
  color: string;
}> = [
  {
    kind: "github",
    label: "GitHub",
    placeholder: "username",
    Glyph: GithubGlyph,
    color: "#1f2328",
  },
  {
    kind: "linkedin",
    label: "LinkedIn",
    placeholder: "username",
    Glyph: LinkedinGlyph,
    color: "#0A66C2",
  },
  {
    kind: "x",
    label: "X",
    placeholder: "@handle",
    Glyph: XGlyph,
    color: "#1f2328",
  },
  {
    kind: "instagram",
    label: "Instagram",
    placeholder: "@handle",
    Glyph: InstagramGlyph,
    color: "#E4405F",
  },
];

type ClaimForm = {
  name: string;
  github: string;
  linkedin: string;
  x: string;
  instagram: string;
};

const EMPTY_FORM: ClaimForm = {
  name: "",
  github: "",
  linkedin: "",
  x: "",
  instagram: "",
};

export default function PhotoPage() {
  const me = useMe();
  const fileRef = useRef<HTMLInputElement>(null);

  const [photo, setPhoto] = useState<PhotoEvent | null>(null);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [status, setStatus] = useState<"idle" | "uploading" | "detecting">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const [pending, setPending] = useState<Point | null>(null); // spot being claimed
  const [form, setForm] = useState<ClaimForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [revealed, setRevealed] = useState<Claim | null>(null);

  // Subscribe to the most-recent (shared) room photo.
  useEffect(() => {
    const unsub = listenLatestPhotoEvent((p) => {
      setPhoto(p);
      setPhotoLoaded(true);
    });
    return () => unsub();
  }, []);

  // Subscribe to the current photo's claims, keyed on the photo ID so it only
  // re-subscribes when the photo actually changes (not on every snapshot of the
  // same doc). On any change, reset per-photo UI so a swap never shows the old
  // photo's markers, a claim sheet bound to the old photo, a reveal card for a
  // vanished claim, or a stale image-load error.
  const photoId = photo?.id ?? null;
  useEffect(() => {
    setClaims([]);
    setPending(null);
    setRevealed(null);
    setImgError(false);
    if (!photoId) return;
    const unsub = listenClaims(photoId, setClaims);
    return () => unsub();
  }, [photoId]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file || status !== "idle") return; // ignore re-entrant uploads
    setError(null);
    setRevealed(null);
    try {
      setStatus("uploading");
      const url = await uploadGroupPhoto(file);

      setStatus("detecting");
      let points: Point[] = [];
      try {
        const r = await fetch("/api/photo-detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: url }),
          signal: AbortSignal.timeout(30000),
        });
        const data = (await r.json()) as { points?: unknown };
        if (Array.isArray(data.points)) points = data.points as Point[];
      } catch (err) {
        // Detection is best-effort; manual tap-to-add still works.
        console.error("[photo] detect failed:", err);
      }

      await createPhotoEvent({ photoURL: url, detectedPoints: points });
      // listenLatestPhotoEvent will surface the new photo automatically.
    } catch (err) {
      console.error("[photo] upload failed:", err);
      setError("Upload failed. Please try again.");
    } finally {
      setStatus("idle");
    }
  }

  function openClaim(x: number, y: number) {
    setRevealed(null);
    setForm({ ...EMPTY_FORM, name: me?.name ?? "" });
    setPending({ x: clamp01(x), y: clamp01(y) });
  }

  function handleBackgroundClick(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    openClaim(
      (e.clientX - rect.left) / rect.width,
      (e.clientY - rect.top) / rect.height,
    );
  }

  async function submitClaim(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!photo || !pending) return;
    setSubmitting(true);
    try {
      await addClaim(photo.id, {
        x: pending.x,
        y: pending.y,
        name: form.name,
        snsLinks: {
          github: form.github,
          linkedin: form.linkedin,
          x: form.x,
          instagram: form.instagram,
        },
        claimedByAttendeeId: me?.id ?? getAnonId(),
      });
      setPending(null);
    } catch (err) {
      console.error("[photo] claim failed:", err);
      setError("Couldn't save your spot. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const busy = status !== "idle";
  // Hide detected markers that already have a claim on top of them. Keep each
  // point's original index for a stable, collision-free React key even when the
  // detector returns duplicate/near-identical coordinates.
  const openPoints = useMemo(
    () =>
      (photo?.detectedPoints ?? [])
        .map((p, i) => ({ ...p, i }))
        .filter(
          (p) =>
            !claims.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < TAKEN_DIST),
        ),
    [photo, claims],
  );

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden bg-gradient-to-b from-background to-accent/40 px-5 py-8">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

      <div className="z-10 w-full max-w-md">
        {/* Header */}
        <header className="mb-5">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" />
            Group Photo
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Leave with the whole room.
          </h1>
          <p className="mt-1 text-muted-foreground">
            Drop the group shot, tap your face, and attach your socials.
            Everyone walks away with everyone&apos;s links.
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!photoLoaded ? (
          <CenteredCard>
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="font-medium">Loading…</p>
          </CenteredCard>
        ) : !photo ? (
          // Empty state — invite the first upload.
          <div className="rounded-2xl border-2 border-dashed bg-card/60 p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ImagePlus className="size-8" />
            </div>
            <p className="font-semibold">Add the group photo</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
              Take or upload one photo of the room. We&apos;ll find everyone so
              they can claim their spot.
            </p>
            <Button
              onClick={() => fileRef.current?.click()}
              size="lg"
              className="mt-5 w-full"
              disabled={busy}
            >
              <Camera />
              Take / upload photo
            </Button>
          </div>
        ) : (
          <>
            {/* The photo + tappable markers */}
            <div className="relative overflow-hidden rounded-2xl border bg-card shadow-xl shadow-primary/5">
              {/* Plain <img>: an arbitrary Storage URL with unknown aspect
                  ratio drives the marker coordinate math, and next/image would
                  require allowlisting the bucket domain in the shared
                  next.config.ts — which this isolated feature must not touch. */}
              <img
                src={photo.photoURL}
                alt="The hackathon crew gathered for the closing group shot"
                className="block w-full select-none"
                draggable={false}
                onError={() => setImgError(true)}
              />

              {imgError ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 bg-muted p-6 text-center text-sm text-muted-foreground">
                  <ImagePlus className="size-7 opacity-60" />
                  Couldn&apos;t display this photo. Try a JPG or PNG, or replace
                  it below.
                </div>
              ) : (
                <>
                  {/* Background tap target: tap empty space to add yourself. */}
                  <button
                    type="button"
                    aria-label="Tap your spot in the photo to add yourself"
                    onClick={handleBackgroundClick}
                    className="absolute inset-0 z-0 cursor-crosshair"
                  />

                  {/* Unclaimed detected people — pulsing "open" markers. */}
                  {openPoints.map((p) => (
                    <button
                      key={`pt-${p.i}`}
                      type="button"
                      aria-label="Claim this spot"
                      onClick={(e) => {
                        e.stopPropagation();
                        openClaim(p.x, p.y);
                      }}
                      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                    >
                      <span className="relative flex size-7 items-center justify-center">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/40" />
                        <span className="relative inline-flex size-4 rounded-full border-2 border-white bg-primary shadow-md" />
                      </span>
                    </button>
                  ))}

                  {/* Claimed people — lit-up avatar markers. */}
                  {claims.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-label={`View ${c.name}'s links`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRevealed(c);
                      }}
                      className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
                    >
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 24,
                        }}
                        className="flex size-9 items-center justify-center rounded-full border-2 border-white bg-primary text-xs font-bold text-primary-foreground shadow-lg ring-2 ring-primary/30"
                      >
                        {initials(c.name)}
                      </motion.span>
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Stats + hint */}
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border bg-card/70 px-4 py-3 text-sm">
              <span className="font-medium">
                {claims.length} claimed
                <span className="text-muted-foreground">
                  {" · "}
                  {photo.detectedPoints.length} detected
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="size-4 text-primary" />
                Tap your face
              </span>
            </div>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Tap a pulsing dot (or anywhere you are) to drop your socials. Tap
              someone&apos;s marker to open theirs.
            </p>

            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              className="mt-4 w-full"
              disabled={busy}
            >
              <Camera />
              Replace photo
            </Button>
          </>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {/* Busy overlay (uploading / detecting) */}
      <AnimatePresence>
        {busy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm"
          >
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="font-medium">
              {status === "uploading"
                ? "Uploading photo…"
                : "Finding everyone in the frame…"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Claim sheet */}
      <AnimatePresence>
        {pending && (
          <>
            <motion.div
              key="claim-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPending(null)}
              className="fixed inset-0 z-50 bg-black/40"
            />
            <motion.div
              key="claim-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-x-0 bottom-0 z-50"
              role="dialog"
              aria-modal="true"
            >
              <form
                onSubmit={submitClaim}
                className="mx-auto w-full max-w-md rounded-t-3xl border-t bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
              >
                <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">This is me</h2>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setPending(null)}
                    className="rounded-full p-1 text-muted-foreground hover:bg-accent"
                  >
                    <XIcon className="size-5" />
                  </button>
                </div>
                <p className="mb-4 text-sm text-muted-foreground">
                  Attach your name and links to this spot. Add only what you
                  want to share.
                </p>

                <label
                  htmlFor="claim-name"
                  className="mb-1 block text-sm font-medium"
                >
                  Name
                </label>
                <Input
                  id="claim-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your name"
                  autoComplete="name"
                  className="mb-4"
                />

                <div className="space-y-3">
                  {SNS_FIELDS.map((f) => (
                    <div key={f.kind} className="relative">
                      <span
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: f.color }}
                      >
                        <f.Glyph className="size-4" />
                      </span>
                      <Input
                        value={form[f.kind]}
                        onChange={(e) =>
                          setForm({ ...form, [f.kind]: e.target.value })
                        }
                        placeholder={`${f.label} — ${f.placeholder}`}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className="pl-9"
                      />
                    </div>
                  ))}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="mt-5 w-full"
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    "Drop my socials here"
                  )}
                </Button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Reveal card */}
      <AnimatePresence>
        {revealed && (
          <>
            <motion.div
              key="reveal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRevealed(null)}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            />
            <div
              key="reveal-card"
              className="fixed inset-0 z-50 flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="w-full max-w-xs rounded-3xl border bg-card p-6 text-center shadow-2xl"
                role="dialog"
                aria-modal="true"
              >
                <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground shadow-lg">
                  {initials(revealed.name)}
                </div>
                <p className="text-lg font-semibold">{revealed.name}</p>
                <p className="mb-4 text-xs text-muted-foreground">
                  Claimed their spot
                </p>

                <RevealLinks claim={revealed} />

                <Button
                  variant="outline"
                  onClick={() => setRevealed(null)}
                  className="mt-5 w-full"
                >
                  Close
                </Button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}

function RevealLinks({ claim }: { claim: Claim }) {
  const links = SNS_FIELDS.map((f) => {
    const raw = claim.snsLinks[f.kind];
    return raw ? { ...f, href: snsHref(f.kind, raw) } : null;
  }).filter((l): l is NonNullable<typeof l> => l !== null && l.href !== "");

  if (links.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No links added — say hi! 👋
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {links.map((l) => (
        <a
          key={l.kind}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          style={{ color: l.color }}
        >
          <l.Glyph className="size-4" />
          {l.label}
        </a>
      ))}
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-12 text-center shadow-sm">
      {children}
    </div>
  );
}
