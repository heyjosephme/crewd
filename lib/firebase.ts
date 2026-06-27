import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  type DocumentData,
  type Firestore,
  getFirestore,
} from "firebase/firestore";
import type { Attendee, Match } from "./types";

// The Firebase *web* config is public by design — it ships in the client bundle of
// every Firebase web app. Security is enforced by Firestore rules, not by hiding this.
// Inlined here (rather than relying on NEXT_PUBLIC_* at build time) so the same values
// work locally, in the Docker build, and on Cloud Run with zero build-arg plumbing.
// NEXT_PUBLIC_* env vars, if present, take precedence for local overrides.
const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "AIzaSyA4MF4gOHy_0ykjRG896ZCdyHK1wKNdD2E",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    "crewd-hackthon.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "crewd-hackthon",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "crewd-hackthon.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "493021969619",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:493021969619:web:a11cbd2a04ae406eed6826",
};

let firestore: Firestore | undefined;

// Lazy singleton: importing this module never touches the network, so the app
// builds and serves a hello-world even before real config/secrets are wired.
export function getDb(): Firestore {
  const app: FirebaseApp = getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);
  if (!firestore) firestore = getFirestore(app);
  return firestore;
}

export const ATTENDEES = "attendees";

// Defensive mapper: a Firestore doc -> a well-typed Attendee, tolerating bad data.
export function toAttendee(id: string, data: DocumentData): Attendee {
  return {
    id,
    name: typeof data.name === "string" ? data.name : "",
    avatar: typeof data.avatar === "string" ? data.avatar : "",
    role: typeof data.role === "string" ? data.role : "",
    building: typeof data.building === "string" ? data.building : "",
    skills: typeof data.skills === "string" ? data.skills : "",
    lookingFor: typeof data.lookingFor === "string" ? data.lookingFor : "",
    createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
    matches: Array.isArray(data.matches)
      ? (data.matches as Match[])
      : undefined,
    matchedAt: typeof data.matchedAt === "number" ? data.matchedAt : undefined,
  };
}
