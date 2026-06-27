import {
  addDoc,
  collection,
  type DocumentData,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getDb, getStorageInstance } from "./firebase";

// ============================================================================
// "Group Photo" feature — ISOLATED helper.
//
// This module is fully self-contained: it imports only getDb/getStorageInstance
// (read-only) from the shared Firebase init and otherwise touches NOTHING in the
// rest of the app. It reads/writes ONLY a new top-level collection, `photoEvents`,
// and its `claims` subcollection — never `attendees` or `rooms`. Safe to delete.
//
// Privacy: detectedPoints come from server-side person DETECTION only (count +
// location). Identity is attached exclusively by a user self-claiming a spot.
// ============================================================================

const PHOTO_EVENTS = "photoEvents";
const CLAIMS = "claims";
// Bound how many markers we ever render, so a bad detection can't flood the UI.
const MAX_POINTS = 60;

// A normalized location on the photo: fractions 0..1 of width/height.
export type Point = { x: number; y: number };

export type SnsLinks = {
  github?: string;
  linkedin?: string;
  x?: string;
  instagram?: string;
};

export const SNS_KINDS = ["github", "linkedin", "x", "instagram"] as const;
export type SnsKind = (typeof SNS_KINDS)[number];

export type PhotoEvent = {
  id: string;
  photoURL: string;
  createdAt: number;
  detectedPoints: Point[];
};

export type Claim = {
  id: string;
  x: number;
  y: number;
  name: string;
  snsLinks: SnsLinks;
  claimedByAttendeeId: string;
  createdAt: number;
};

// NaN-safe clamp to [0,1]. `n > 0` is false for NaN and -Infinity, so both map
// to 0; Infinity maps to 1. Exported so the client uses the exact same bounds.
export const clamp01 = (n: number) => (n > 1 ? 1 : n > 0 ? n : 0);

// --- Defensive mappers (Firestore doc -> typed, tolerating bad/legacy data) ---

function toPoint(v: unknown): Point | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { x?: unknown; y?: unknown };
  if (typeof o.x !== "number" || typeof o.y !== "number") return null;
  if (Number.isNaN(o.x) || Number.isNaN(o.y)) return null;
  return { x: clamp01(o.x), y: clamp01(o.y) };
}

function toSnsLinks(v: unknown): SnsLinks {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const out: SnsLinks = {};
  for (const k of SNS_KINDS) {
    const val = o[k];
    if (typeof val === "string" && val.trim()) out[k] = val.trim();
  }
  return out;
}

export function toPhotoEvent(id: string, d: DocumentData): PhotoEvent {
  const pts = Array.isArray(d.detectedPoints) ? d.detectedPoints : [];
  return {
    id,
    photoURL: typeof d.photoURL === "string" ? d.photoURL : "",
    createdAt: typeof d.createdAt === "number" ? d.createdAt : 0,
    detectedPoints: pts
      .map(toPoint)
      .filter((p): p is Point => p !== null)
      .slice(0, MAX_POINTS),
  };
}

export function toClaim(id: string, d: DocumentData): Claim {
  return {
    id,
    x: typeof d.x === "number" ? clamp01(d.x) : 0,
    y: typeof d.y === "number" ? clamp01(d.y) : 0,
    name: typeof d.name === "string" && d.name.trim() ? d.name : "Someone",
    snsLinks: toSnsLinks(d.snsLinks),
    claimedByAttendeeId:
      typeof d.claimedByAttendeeId === "string" ? d.claimedByAttendeeId : "",
    createdAt: typeof d.createdAt === "number" ? d.createdAt : 0,
  };
}

// --- Storage ---

// Upload ONE group photo to Firebase Storage; returns its download URL.
// Mirrors lib/rooms.ts::uploadMeetupPhoto but writes under its own path prefix.
export async function uploadGroupPhoto(file: File): Promise<string> {
  const safeName = file.name.replace(/[^\w.-]/g, "_");
  const r = ref(getStorageInstance(), `photoEvents/${Date.now()}-${safeName}`);
  await uploadBytes(r, file);
  return getDownloadURL(r);
}

// --- Firestore: photoEvents ---

export async function createPhotoEvent(input: {
  photoURL: string;
  detectedPoints: Point[];
}): Promise<string> {
  const created = await addDoc(collection(getDb(), PHOTO_EVENTS), {
    photoURL: input.photoURL,
    detectedPoints: input.detectedPoints
      .slice(0, MAX_POINTS)
      .map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) })),
    createdAt: Date.now(),
  });
  return created.id;
}

// Subscribe to the most-recent photo event (the "current" room photo). Returns
// null when none exists yet. Newly-created events surface automatically.
export function listenLatestPhotoEvent(
  cb: (photo: PhotoEvent | null) => void,
): () => void {
  const q = query(
    collection(getDb(), PHOTO_EVENTS),
    orderBy("createdAt", "desc"),
    limit(1),
  );
  return onSnapshot(
    q,
    (snap) => {
      const first = snap.docs[0];
      cb(first ? toPhotoEvent(first.id, first.data()) : null);
    },
    (err) => {
      // Degrade gracefully: surface "no photo" so the UI shows the upload
      // state instead of hanging on a spinner forever.
      console.error("[photo] latest listen error:", err);
      cb(null);
    },
  );
}

// --- Firestore: claims (subcollection of a photo event) ---

export function listenClaims(
  photoId: string,
  cb: (claims: Claim[]) => void,
): () => void {
  const q = query(
    collection(getDb(), PHOTO_EVENTS, photoId, CLAIMS),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => toClaim(d.id, d.data()))),
    (err) => {
      console.error("[photo] claims listen error:", err);
      cb([]);
    },
  );
}

export async function addClaim(
  photoId: string,
  input: {
    x: number;
    y: number;
    name: string;
    snsLinks: SnsLinks;
    claimedByAttendeeId: string;
  },
): Promise<string> {
  const created = await addDoc(
    collection(getDb(), PHOTO_EVENTS, photoId, CLAIMS),
    {
      x: clamp01(input.x),
      y: clamp01(input.y),
      name: input.name.trim() || "Someone",
      snsLinks: toSnsLinks(input.snsLinks),
      claimedByAttendeeId: input.claimedByAttendeeId,
      createdAt: Date.now(),
    },
  );
  return created.id;
}

// --- SNS link normalization ---

const SNS_BASE: Record<SnsKind, string> = {
  github: "https://github.com/",
  linkedin: "https://www.linkedin.com/in/",
  x: "https://x.com/",
  instagram: "https://www.instagram.com/",
};

// Turn a raw value (full URL, "@handle", or bare handle) into a safe absolute
// URL. Returns "" for empty input so callers can skip rendering the link.
export function snsHref(kind: SnsKind, value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  let handle = v.replace(/^@+/, "").replace(/^\/+/, "");
  // LinkedIn's base already ends in "in/"; don't double it if the user pasted
  // a value like "in/username".
  if (kind === "linkedin") handle = handle.replace(/^in\//i, "");
  return SNS_BASE[kind] + handle;
}
