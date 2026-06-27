# Build prompt for Code Agent — "Crewd"

You are building **Crewd**, a hackathon MVP. It must be demoable in ~5 hours by a small team. Build only the P0 scope defined below. Do not add features beyond it. Optimize for "works and demos live," not for completeness or polish.

## What Crewd does (one paragraph)
At a 500-person hackathon, people waste the check-in queue doing nothing, then scramble to form teams. Crewd turns the queue into a head start: an attendee scans a QR code, fills a 4-field profile in ~30 seconds, and Gemini instantly recommends the top 3 people in the room they should team up with — **with a one-sentence human reason for each match**. A big-screen view updates live as people join, and is the climax of a 2-minute live demo where the audience scans the QR and matches appear on stage in real time.

## Locked tech decisions (do not deviate, do not ask)
- **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**, single deployable.
- **Firestore** for persistence and **real-time updates via `onSnapshot`**. No SQL, no other DB.
- **Gemini via the official `@google/genai` npm package** (NOT the deprecated `@google/generative-ai`). Import: `import { GoogleGenAI } from "@google/genai";`. Model string: `gemini-3.5-flash`.
- **Gemini is called ONLY server-side** (in Route Handlers). The API key must never reach the client. Read it from `process.env.GEMINI_API_KEY`.
- **Deploy target: Google Cloud Run.** Configure `output: "standalone"` in `next.config` and include a minimal Dockerfile. Also document the `gcloud run deploy` command.
- **No auth, no accounts, no login.** Identity = an anonymous random ID generated on first scan and kept in the URL / local state. This is intentional; do not add auth.

## P0 scope — build exactly these, nothing more
1. **Scan landing page** (mobile-first): the page the QR points to. Minimal. Routes the user into the profile form.
2. **Profile form → writes to Firestore.** Exactly 4 fields: `name`, `building` (what they want to build / direction), `skills`, `lookingFor` (what kind of teammate they want). This single screen IS the onboarding + self-intro; do not split it.
3. **Match API** — a server-side Route Handler (e.g. `app/api/match/route.ts`). On submit, it fetches the current roster from Firestore, calls Gemini once **for the newly submitted person only**, and returns **top 3 matches each with a one-sentence reason**. Persist the result. (See constraints below — do NOT recompute the whole room on every join.)
4. **Personal result page**: after submit, the user sees their top 3 matches, the reason for each, and how to find them (e.g. a short identifying note / their `name`).
5. **Big-screen live view** (`/screen` or similar): a display-optimized page that uses Firestore `onSnapshot` to show people joining and matches forming in real time. This is the demo climax — make it look alive and legible from across a room.
6. **QR code generation**: generate a QR pointing to the landing page URL. Trivial, but required.
7. **Seed script: ~20 fake attendee profiles** in Firestore, realistic and varied (mix of engineers, designers, PMs, students, with varied `building`/`skills`/`lookingFor`). This is P0, not optional — the demo and the matching are dead without a populated room.
8. **Cloud Run deploy**: must run as a real public URL (localhost can't be scanned by a crowd). Make the very first milestone "hello-world deployed to Cloud Run," then keep deploying.

## Explicitly OUT of scope (do not build)
Login/accounts; editing a profile after submit; in-app chat; real team "locking"/commit; profile-picture or face anything; the group-photo feature; LinkedIn/X auto-scraping. If tempted, stop.

## Critical implementation constraints (these prevent the common failures)
- **Match-on-submit only.** A new submission triggers exactly ONE Gemini call, for that one person, against the current roster. Never run a full-room re-match on every join.
- **Bound the prompt.** Do not stuff all 500 profiles into the model on every call. Pass a trimmed/pre-filtered roster (and cap roster size) so calls stay fast, cheap, and within context.
- **Big screen is passive.** `/screen` only listens via `onSnapshot` and re-renders; it never triggers matching itself.
- **Keep the key server-side.** No Gemini calls from client components. All model access goes through Route Handlers.
- **Robust Gemini parsing.** Prompt Gemini to return strict JSON (top 3 with `name` + `reason`); parse defensively and handle malformed output without crashing the request.

## Suggested file layout (adapt as needed, keep it ~this small)
- `next.config.*` — with `output: "standalone"`
- `app/page.tsx` — scan landing → profile form (shadcn form components)
- `app/api/match/route.ts` — server-side: roster fetch + Gemini call + return/persist top 3
- `app/result/[id]/page.tsx` — personal matches view
- `app/screen/page.tsx` — big-screen live view (`onSnapshot`)
- `lib/firestore.ts` — Firestore init + read/write helpers
- `lib/gemini.ts` — `@google/genai` client + the match function (strict-JSON prompt + defensive parse)
- `scripts/seed.ts` — seed ~20 fake profiles
- `Dockerfile` — minimal, for Cloud Run standalone
- `README.md` — env vars (`GEMINI_API_KEY`, Firebase/Firestore config) + `gcloud run deploy` command

## Build order (so there's always something demoable)
1. Scaffold Next + TS + Tailwind + shadcn; deploy a hello-world to Cloud Run; confirm the public URL works.
2. Firestore wired; profile form writes a doc; seed script populates ~20 fakes.
3. `/api/match` returns top 3 + reasons from Gemini for the submitting person; result page renders them.
4. `/screen` live view via `onSnapshot`; generate the QR; rehearse the end-to-end "scan → match → screen updates" loop.

## Definition of done (P0)
On a deployed Cloud Run URL: I scan the QR on a phone → fill 4 fields → within seconds see my top 3 matches each with a one-sentence reason → and the `/screen` view reflects my arrival/match live. The room is pre-seeded so this works even with only a few real scans.

Start with build-order step 1. Ask me only for required secrets/config (Gemini key, Firebase project); make every other decision yourself per the locked choices above.
