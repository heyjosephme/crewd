# crewd.

Turn the hackathon check-in queue into a head start. An attendee scans a QR, fills a
4-field profile in ~30 seconds, and **Gemini instantly recommends the top 3 people in
the room to team up with — each with a one-sentence human reason.** A big-screen view
updates live as people join.

## How it works

- **Next.js (App Router) + TypeScript + Tailwind v4 + shadcn/ui**, single deployable.
- **Firestore** for persistence + real-time updates (`onSnapshot`).
- **Gemini** via `@google/genai` (`gemini-3.5-flash`), called **only** server-side in
  `app/api/match/route.ts`.
- **No auth.** Identity is the anonymous Firestore doc id kept in the URL.

### Routes

| Route          | What it is                                                        |
| -------------- | ---------------------------------------------------------------- |
| `/`            | Scan landing → 4-field profile form                              |
| `/result/[id]` | Your top 3 matches + reasons (live via `onSnapshot`)            |
| `/screen`      | Big-screen live view + join QR (passive; only listens)          |
| `/qr`          | Standalone printable QR poster                                   |
| `/api/match`   | Server: write profile → fetch roster → 1 Gemini call → persist  |

### Design notes (why it deploys cleanly)

- The Firebase **web** config is public by design, so it's inlined in `lib/firebase.ts`
  (env-overridable). This sidesteps the `NEXT_PUBLIC_*`-at-build-time pain on Cloud Run.
- The **only real secret is `GEMINI_API_KEY`**, set as a Cloud Run runtime env var.
- The match call runs **once per submission, for that one person**, against a bounded
  candidate set — never a full-room re-match.

## 1. Configure

Create a Firebase project, enable **Firestore (Native mode)**, and register a **Web app**
to get the config. Then fill `.env.local`:

```bash
# The only real secret (https://aistudio.google.com/apikey)
GEMINI_API_KEY=...

# Firebase web config (public). Firebase console → Project settings → Your apps → Web.
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

The same Firebase web values are also inlined as fallbacks in `lib/firebase.ts` for the
deployed build.

**Firestore rules** (demo-only, open access — this app intentionally has no auth):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /attendees/{doc} {
      allow read, write: if true;
    }
  }
}
```

## 2. Seed the room (~20 fake attendees)

The demo and the matching are dead without a populated room.

```bash
pnpm seed   # = node --env-file=.env.local scripts/seed.ts  (idempotent)
```

## 3. Run locally

```bash
pnpm install
pnpm dev
# http://localhost:3000  (form)   ·   /screen (big view)
```

## 4. Deploy to Cloud Run

Requires a billing-enabled GCP project (your Firebase project is one) and
`gcloud auth login`. Uses the included `Dockerfile` (`output: "standalone"`).

```bash
gcloud config set project YOUR_PROJECT_ID

gcloud run deploy crewd \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=YOUR_GEMINI_KEY
```

The command prints a public HTTPS URL — that's what the QR points to (the `/screen` and
`/qr` pages build the QR from the page's own origin, so no extra config is needed).
