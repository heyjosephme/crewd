// Shared profile vocabulary used by the form, the live screen, and the result page.
// Roles are playful self-descriptions (a "vibe"), not strict job titles — they give
// the matcher a fast complementary-pairing signal and the UI an identity at a glance.
export type Role = { key: string; emoji: string; label: string };

export const ROLES: Role[] = [
  { key: "Coder", emoji: "⌨️", label: "Coder" },
  { key: "Speaker", emoji: "🎤", label: "Speaker" },
  { key: "Designer", emoji: "🎨", label: "Designer" },
  { key: "Viber", emoji: "😎", label: "Viber" },
  { key: "HuntingGhost", emoji: "👻", label: "Hunting Ghost" },
];

const ROLE_BY_KEY = new Map(ROLES.map((r) => [r.key, r]));

/** Look up a role's emoji/label by key; undefined for unknown/empty keys. */
export function roleMeta(key?: string): Role | undefined {
  return key ? ROLE_BY_KEY.get(key) : undefined;
}

export function isRole(key: string): boolean {
  return ROLE_BY_KEY.has(key);
}

// A small, friendly emoji set to pick an identity from — Notion-style page icons,
// not photos. Intentionally avatar-as-emoji so there's zero upload/face anything.
export const AVATARS = [
  "🦊",
  "🐼",
  "🐱",
  "🦁",
  "🦉",
  "🐲",
  "🐸",
  "🦝",
  "🐙",
  "🐯",
  "🦄",
  "👾",
  "🐰",
  "🤖",
  "🦖",
  "🐢",
  "🐝",
  "🐨",
  "🐧",
  "🐶",
];

// Fallback for older/seeded docs that predate avatars.
export const DEFAULT_AVATAR = "🧑‍💻";

const ADJECTIVES = [
  "Cosmic",
  "Neon",
  "Turbo",
  "Quantum",
  "Pixel",
  "Hyper",
  "Lunar",
  "Solar",
  "Mega",
  "Cyber",
  "Velvet",
  "Electric",
  "Midnight",
  "Golden",
  "Wild",
  "Swift",
  "Brave",
  "Clever",
  "Fuzzy",
  "Rapid",
];

const ANIMALS = [
  "Otter",
  "Falcon",
  "Panda",
  "Fox",
  "Lynx",
  "Koala",
  "Raven",
  "Tiger",
  "Dolphin",
  "Wolf",
  "Hawk",
  "Badger",
  "Heron",
  "Gecko",
  "Phoenix",
  "Bison",
  "Cobra",
  "Manta",
  "Orca",
  "Yak",
];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** A fun, throwaway handle like "Cosmic Otter" — re-rollable from the form. */
export function randomName(): string {
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
}

export function randomAvatar(): string {
  return pick(AVATARS);
}
