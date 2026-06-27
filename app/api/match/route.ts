import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { NextResponse } from "next/server";
import { ATTENDEES, getDb, toAttendee } from "@/lib/firebase";
import { matchAttendee } from "@/lib/gemini";

// Firebase JS SDK needs the Node runtime (not Edge). Never cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Match an EXISTING attendee (created client-side on submit, so identity is instant
 * and never waits on the model). Runs exactly ONE Gemini call for this person against
 * the current roster and persists the top-3. Idempotent: if already matched, returns
 * the stored result without calling the model again. The big screen just listens.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { id?: string };
    const id = (body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "Missing attendee id." }, { status: 400 });
    }

    const db = getDb();
    const ref = doc(db, ATTENDEES, id);
    const self = await getDoc(ref);
    if (!self.exists()) {
      return NextResponse.json({ error: "Attendee not found." }, { status: 404 });
    }
    const person = toAttendee(self.id, self.data());

    // Idempotent: don't re-run the model if this person was already matched
    // (handles result-page revisits and shared links without extra Gemini calls).
    if (person.matchedAt) {
      return NextResponse.json({ id, matches: person.matches ?? [] });
    }

    // Read the current roster (includes self; the matcher filters self out).
    const snap = await getDocs(collection(db, ATTENDEES));
    const roster = snap.docs.map((d) => toAttendee(d.id, d.data()));

    const matches = await matchAttendee(person, roster);

    await updateDoc(ref, { matches, matchedAt: Date.now() });

    return NextResponse.json({ id, matches });
  } catch (err) {
    console.error("[/api/match] error:", err);
    return NextResponse.json(
      { error: "Matching failed. Please try again." },
      { status: 500 },
    );
  }
}
