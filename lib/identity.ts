"use client";

import { useEffect, useState } from "react";
import { randomAvatar, randomName } from "./profile";

// The single anonymous identity, reused everywhere (rooms, chat, the Me tab).
// It IS the attendee created by the Find flow — we just persist a copy client-side
// so other tabs can reuse the id without re-running the match. No second identity.
export type Me = {
  id: string; // the attendee doc id from /api/match
  name: string;
  avatar: string;
  role: string;
};

const KEY = "crewd:me";
const EVENT = "crewd:me-changed";

export function getMe(): Me | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Me) : null;
  } catch {
    return null;
  }
}

export function setMe(me: Me): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(me));
  window.dispatchEvent(new Event(EVENT));
}

// Get-or-create the local identity. Called on first load so everyone has a default
// profile (auto name + avatar, no role yet) and can use Rooms/chat without doing Find.
// Writes NOTHING to Firestore — a real attendee doc is created only at "Find my crew".
export function ensureMe(): Me {
  const existing = getMe();
  if (existing) return existing;
  const me: Me = {
    id: crypto.randomUUID(),
    name: randomName(),
    avatar: randomAvatar(),
    role: "",
  };
  setMe(me);
  return me;
}

// Reactive read — updates when identity is captured (same tab) or changes (other tab).
export function useMe(): Me | null {
  const [me, setMeState] = useState<Me | null>(null);
  useEffect(() => {
    const sync = () => setMeState(getMe());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return me;
}
