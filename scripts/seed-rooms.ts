/**
 * Seeds 5 fake rooms (some with a meetup note + placeholder photo, one with chat)
 * so the Rooms tab and a room's chat look alive during the demo. Self-contained so
 * Node 24 runs it directly:  node --env-file=.env.local scripts/seed-rooms.ts
 * Re-running clears existing rooms (and their messages) first.
 */
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  console.error(
    "✗ Missing Firebase config. Fill .env.local, then run:\n  node --env-file=.env.local scripts/seed-rooms.ts",
  );
  process.exit(1);
}

const ROOMS = "rooms";
const photo = (seed: string) => `https://picsum.photos/seed/${seed}/800/450`;

const SEED = [
  {
    name: "Vibe Coders — need a designer",
    meetupNote: "3F lounge, big yellow beanbags 🟡",
    meetupPhotoURL: photo("crewd-vibe"),
    messages: [] as { name: string; avatar: string; text: string }[],
  },
  {
    name: "Multimodal Mixer",
    meetupNote: null,
    meetupPhotoURL: null,
    messages: [],
  },
  {
    name: "Gemini Agents squad — 4F sofas",
    meetupNote: "4F sofas by the window — look for the sticker-covered laptop",
    meetupPhotoURL: photo("crewd-gemini"),
    messages: [
      { name: "Kenji Tanaka", avatar: "🐢", text: "Grabbed the 4F sofas! 2 seats left." },
      { name: "Priya Patel", avatar: "🐱", text: "On my way ✋" },
      { name: "Noah Williams", avatar: "🐯", text: "Anyone have a spare HDMI cable?" },
    ],
  },
  {
    name: "Climate Hack Collective 🌍",
    meetupNote: null,
    meetupPhotoURL: null,
    messages: [],
  },
  {
    name: "Late-Night Shippers ☕",
    meetupNote: "Cafeteria corner table — I'm in the green cap",
    meetupPhotoURL: null,
    messages: [],
  },
];

async function main() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const existing = await getDocs(collection(db, ROOMS));
  if (existing.size > 0) {
    console.log(`Clearing ${existing.size} existing rooms…`);
    for (const d of existing.docs) {
      const msgs = await getDocs(collection(db, ROOMS, d.id, "messages"));
      await Promise.all(
        msgs.docs.map((m) => deleteDoc(doc(db, ROOMS, d.id, "messages", m.id))),
      );
      await deleteDoc(doc(db, ROOMS, d.id));
    }
  }

  let t = Date.now() - SEED.length * 60_000;
  for (const r of SEED) {
    t += 60_000;
    const room = await addDoc(collection(db, ROOMS), {
      name: r.name,
      creatorId: "seed-host",
      createdAt: t,
      meetupNote: r.meetupNote,
      meetupPhotoURL: r.meetupPhotoURL,
    });
    let mt = t + 1_000;
    for (const m of r.messages) {
      await addDoc(collection(db, ROOMS, room.id, "messages"), {
        senderId: `seed-${m.name.split(" ")[0].toLowerCase()}`,
        senderName: m.name,
        senderAvatar: m.avatar,
        text: m.text,
        createdAt: mt,
      });
      mt += 1_000;
    }
    console.log(`+ ${r.name}${r.messages.length ? ` (+${r.messages.length} msgs)` : ""}`);
  }

  console.log(`\n✅ Seeded ${SEED.length} rooms into "${ROOMS}".`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed rooms failed:", err);
  process.exit(1);
});
