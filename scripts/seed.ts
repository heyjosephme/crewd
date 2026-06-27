/**
 * Seeds ~20 varied fake attendees into Firestore so the room (and the matching)
 * has signal before any real scans. Self-contained on purpose — no project imports —
 * so Node 24 can run it directly with native TS type-stripping:
 *
 *   node --env-file=.env.local scripts/seed.ts
 *
 * Re-running clears the collection first, so it's idempotent.
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
    "✗ Missing Firebase config. Fill .env.local, then run:\n  node --env-file=.env.local scripts/seed.ts",
  );
  process.exit(1);
}

const COL = "attendees";

// role is one of: Coder | Speaker | Designer | Viber | HuntingGhost (see lib/profile).
// avatar is a plain emoji. Kept inline so this script stays import-free.
const PROFILES = [
  {
    name: "Maya Chen",
    avatar: "🦊",
    role: "Coder",
    building:
      "An AI study buddy that turns lecture notes into adaptive quizzes.",
    skills: "ML, Python, NLP, prompt engineering.",
    lookingFor: "A frontend dev and a designer to make it feel magical.",
  },
  {
    name: "Diego Santos",
    avatar: "🐼",
    role: "Coder",
    building: "A fintech app that smooths out income for gig workers.",
    skills: "Backend (Go), Postgres, payments APIs.",
    lookingFor: "A mobile developer and a product designer.",
  },
  {
    name: "Priya Patel",
    avatar: "🐱",
    role: "Designer",
    building: "A mental-health check-in app for students.",
    skills: "Product design, Figma, user research, UX writing.",
    lookingFor: "A full-stack engineer who can move fast.",
  },
  {
    name: "Sam O'Brien",
    avatar: "🦁",
    role: "Speaker",
    building: "A B2B tool that auto-summarizes sales calls.",
    skills: "Product, go-to-market, pitching, customer interviews.",
    lookingFor: "A technical co-founder to build the MVP.",
  },
  {
    name: "Aisha Khan",
    avatar: "🦉",
    role: "Coder",
    building: "A live climate dashboard for cities.",
    skills: "Data viz, D3.js, React, mapping.",
    lookingFor: "A backend / data engineer for the pipelines.",
  },
  {
    name: "Leo Müller",
    avatar: "🐲",
    role: "Coder",
    building: "AR indoor navigation for big venues.",
    skills: "Unity, C#, 3D, computer vision basics.",
    lookingFor: "An ML engineer and a UI designer.",
  },
  {
    name: "Hannah Kim",
    avatar: "🐸",
    role: "Coder",
    building: "A campus events app that fights FOMO.",
    skills: "React Native, Firebase, TypeScript. CS student.",
    lookingFor: "A designer and a PM to shape it.",
  },
  {
    name: "Tomás Rivera",
    avatar: "🦝",
    role: "Coder",
    building: "A CLI that scaffolds and deploys side projects in one command.",
    skills: "Rust, systems programming, DX.",
    lookingFor: "A frontend dev and a developer-experience designer.",
  },
  {
    name: "Grace Liu",
    avatar: "🐙",
    role: "Coder",
    building: "A hands-free voice assistant for the kitchen.",
    skills: "Speech ML, Python, audio processing.",
    lookingFor: "A mobile developer and a UX designer.",
  },
  {
    name: "Noah Williams",
    avatar: "🐯",
    role: "Coder",
    building: "A marketplace for local makers to sell instantly.",
    skills: "Next.js, Stripe, full-stack TypeScript.",
    lookingFor: "A brand designer and a growth person.",
  },
  {
    name: "Fatima Al-Sayed",
    avatar: "🦄",
    role: "Designer",
    building: "A browser extension that makes any site screen-reader friendly.",
    skills: "Frontend, accessibility (a11y), TypeScript.",
    lookingFor: "An ML engineer and a PM.",
  },
  {
    name: "Ethan Park",
    avatar: "👾",
    role: "Viber",
    building: "A co-op puzzle game you play over video calls.",
    skills: "Game dev, Godot, gameplay design.",
    lookingFor: "A 2D artist and a sound designer.",
  },
  {
    name: "Sofia Rossi",
    avatar: "🐰",
    role: "Designer",
    building: "A creative tool that turns sketches into animated logos.",
    skills: "Brand design, motion, illustration, Figma.",
    lookingFor: "A frontend engineer to bring it to life.",
  },
  {
    name: "Raj Mehta",
    avatar: "🤖",
    role: "Coder",
    building: "A low-cost air-quality sensor with a companion app.",
    skills: "Embedded C, electronics, IoT.",
    lookingFor: "An app developer and someone for the cloud backend.",
  },
  {
    name: "Olivia Brown",
    avatar: "🦖",
    role: "Coder",
    building: "An edtech platform for peer-to-peer tutoring.",
    skills: "Full-stack, Django, Python.",
    lookingFor: "A designer and a content/marketing person.",
  },
  {
    name: "Kenji Tanaka",
    avatar: "🐢",
    role: "Coder",
    building: "A computer-vision app that logs meals from a photo.",
    skills: "Computer vision, PyTorch, Python.",
    lookingFor: "A frontend dev and a product thinker.",
  },
  {
    name: "Amara Okafor",
    avatar: "🐝",
    role: "Speaker",
    building: "A social app for finding workout partners nearby.",
    skills: "Growth, analytics, pitching, community.",
    lookingFor: "An engineering team — frontend + backend.",
  },
  {
    name: "Lucas Silva",
    avatar: "🐨",
    role: "HuntingGhost",
    building: "Instant cross-border payments with stablecoins.",
    skills: "Solidity, web3, smart contracts.",
    lookingFor: "A frontend dev and a security-minded engineer.",
  },
  {
    name: "Emma Wilson",
    avatar: "🐧",
    role: "Coder",
    building: "An analytics tool that explains your numbers in plain English.",
    skills: "Data science, Python, pandas, SQL.",
    lookingFor: "A frontend developer and a PM.",
  },
  {
    name: "Yuki Sato",
    avatar: "🐶",
    role: "Viber",
    building: "A productivity app that plans your day around your energy.",
    skills: "Full-stack, TypeScript, Node, React.",
    lookingFor: "A designer and an ML engineer.",
  },
];

async function main() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const existing = await getDocs(collection(db, COL));
  if (existing.size > 0) {
    console.log(`Clearing ${existing.size} existing attendees…`);
    await Promise.all(existing.docs.map((d) => deleteDoc(doc(db, COL, d.id))));
  }

  // Spread createdAt so the live feed has a natural order.
  let t = Date.now() - PROFILES.length * 1000;
  for (const p of PROFILES) {
    t += 1000;
    await addDoc(collection(db, COL), { ...p, createdAt: t });
    console.log(`+ ${p.name}`);
  }

  console.log(`\n✅ Seeded ${PROFILES.length} attendees into "${COL}".`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
