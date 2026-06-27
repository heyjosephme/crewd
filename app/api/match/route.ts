import {
  addDoc,
  collection,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { NextResponse } from "next/server";
import { ATTENDEES, getDb, toAttendee } from "@/lib/firebase";
import { matchAttendee } from "@/lib/gemini";
import { DEFAULT_AVATAR, isRole } from "@/lib/profile";
import type { Attendee } from "@/lib/types";

// Firebase JS SDK needs the Node runtime (not Edge). Never cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Match-on-submit: write the new profile, fetch the current roster, run exactly ONE
 * Gemini call for THIS person, persist their top-3, and return them. We never
 * recompute the whole room here — the big screen just listens via onSnapshot.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<
      Record<
        "name" | "avatar" | "role" | "building" | "skills" | "lookingFor",
        string
      >
    >;
    const name = (body.name ?? "").trim();
    const role = (body.role ?? "").trim();
    const avatar = (body.avatar ?? "").trim() || DEFAULT_AVATAR;
    const building = (body.building ?? "").trim();
    const skills = (body.skills ?? "").trim();
    const lookingFor = (body.lookingFor ?? "").trim();

    // Onboarding is just a name + a role now; the text fields are optional context.
    if (!name || !isRole(role)) {
      return NextResponse.json(
        { error: "A name and a role are required." },
        { status: 400 },
      );
    }

    const db = getDb();
    const col = collection(db, ATTENDEES);

    // 1) Persist the new attendee so they appear on the live screen immediately.
    const createdAt = Date.now();
    const ref = await addDoc(col, {
      name,
      avatar,
      role,
      building,
      skills,
      lookingFor,
      createdAt,
    });
    const person: Attendee = {
      id: ref.id,
      name,
      avatar,
      role,
      building,
      skills,
      lookingFor,
      createdAt,
    };

    // 2) Read the current roster (includes the new person; the matcher filters self out).
    const snap = await getDocs(col);
    const roster = snap.docs.map((d) => toAttendee(d.id, d.data()));

    // 3) One model call, just for this person, against a bounded candidate set.
    const matches = await matchAttendee(person, roster);

    // 4) Persist the result so the screen + result page reflect it in real time.
    await updateDoc(doc(db, ATTENDEES, ref.id), {
      matches,
      matchedAt: Date.now(),
    });

    return NextResponse.json({ id: ref.id, matches });
  } catch (err) {
    console.error("[/api/match] error:", err);
    return NextResponse.json(
      { error: "Matching failed. Please try again." },
      { status: 500 },
    );
  }
}
