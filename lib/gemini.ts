import { GoogleGenAI, Type } from "@google/genai";
import type { Attendee, Match } from "./types";

// Locked default per spec; overridable via env only as an escape hatch.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
// Bound the prompt: never stuff the whole room into the model.
const MAX_CANDIDATES = 40;
const MAX_FIELD = 240;

let client: GoogleGenAI | undefined;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

const clip = (s: string) => (s ?? "").slice(0, MAX_FIELD);

/**
 * One match computation for ONE newly-joined person against the current roster.
 * Tries Gemini first (strict JSON); falls back to a token-overlap heuristic so the
 * demo never shows an empty result, even if the model is unavailable.
 */
export async function matchAttendee(
  person: Attendee,
  roster: Attendee[],
): Promise<Match[]> {
  const candidates = roster
    .filter((a) => a.id !== person.id && a.name.trim().length > 0)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_CANDIDATES);

  if (candidates.length === 0) return [];

  try {
    const viaAi = await geminiMatches(person, candidates);
    if (viaAi.length > 0) return viaAi;
    console.warn("[gemini] returned no usable matches; using heuristic");
  } catch (err) {
    console.error("[gemini] match failed, falling back to heuristic:", err);
  }
  return heuristicMatches(person, candidates);
}

async function geminiMatches(
  person: Attendee,
  candidates: Attendee[],
): Promise<Match[]> {
  const candidateList = candidates.map((c) => ({
    id: c.id,
    name: c.name,
    role: c.role,
    building: clip(c.building),
    skills: clip(c.skills),
    lookingFor: clip(c.lookingFor),
  }));

  const prompt = [
    "You are the live matchmaking engine for a hackathon happening right now.",
    "A new attendee just joined the room. From the CANDIDATES list, pick the 3 best",
    "teammates for them, optimizing for complementary roles and skills plus aligned",
    "goals (what they want to build + the kind of teammate they're looking for).",
    "Prefer complementary roles — e.g. pair a Coder with a Designer, Speaker, or",
    "Viber rather than another identical role — unless the free-text says otherwise.",
    "Some fields may be empty; lean on role and whatever text is provided.",
    "",
    "NEW ATTENDEE:",
    JSON.stringify({
      name: person.name,
      role: person.role,
      building: clip(person.building),
      skills: clip(person.skills),
      lookingFor: clip(person.lookingFor),
    }),
    "",
    "CANDIDATES (only ever choose ids from this list):",
    JSON.stringify(candidateList),
    "",
    'Return strict JSON of the form {"matches":[{"id":"<candidate id>","reason":"<one warm, specific sentence, max 22 words, naming something concrete from both profiles about why they should team up>"}]}.',
    "Return exactly 3 matches (or fewer only if fewer candidates exist). Never invent an id.",
  ].join("\n");

  const res = await getClient().models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.5,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          matches: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
              required: ["id", "reason"],
            },
          },
        },
        required: ["matches"],
      },
    },
  });

  const parsed = safeParse(res.text ?? "") as { matches?: unknown };
  const raw = Array.isArray(parsed?.matches) ? parsed.matches : [];

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const matches: Match[] = [];
  for (const entry of raw) {
    const m = entry as { id?: unknown; reason?: unknown };
    const id = typeof m.id === "string" ? m.id : "";
    const reason = typeof m.reason === "string" ? m.reason.trim() : "";
    const c = byId.get(id);
    if (!c || seen.has(id) || reason.length === 0) continue;
    seen.add(id);
    matches.push({
      id: c.id,
      name: c.name,
      avatar: c.avatar,
      role: c.role,
      building: c.building,
      reason,
    });
    if (matches.length === 3) break;
  }
  return matches;
}

function safeParse(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// --- Heuristic fallback (no model required) ---

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "for",
  "with",
  "in",
  "on",
  "at",
  "im",
  "i'm",
  "my",
  "me",
  "we",
  "our",
  "want",
  "looking",
  "build",
  "building",
  "someone",
  "who",
  "that",
  "this",
  "is",
  "are",
  "be",
  "using",
  "app",
  "make",
  "making",
  "need",
  "help",
]);

function tokenize(s: string): Set<string> {
  const tokens = (s ?? "").toLowerCase().match(/[a-z0-9+#.]+/g) ?? [];
  return new Set(tokens.filter((t) => t.length > 1 && !STOP.has(t)));
}

function heuristicMatches(person: Attendee, candidates: Attendee[]): Match[] {
  const want = tokenize(
    `${person.lookingFor} ${person.building} ${person.skills}`,
  );
  return candidates
    .map((c) => {
      const have = tokenize(`${c.skills} ${c.building} ${c.lookingFor}`);
      const shared = [...want].filter((t) => have.has(t));
      // Nudge toward complementary roles (a Coder + Designer beats two Coders).
      const roleBonus = person.role && c.role && person.role !== c.role ? 1 : 0;
      return { c, score: shared.length + roleBonus, shared };
    })
    .sort((a, b) => b.score - a.score || b.c.createdAt - a.c.createdAt)
    .slice(0, 3)
    .map(({ c, shared }) => ({
      id: c.id,
      name: c.name,
      avatar: c.avatar,
      role: c.role,
      building: c.building,
      reason:
        shared.length > 0
          ? `You both touch on ${shared.slice(0, 3).join(", ")} — could be a strong fit.`
          : `${c.name} is building "${c.building}" and may complement what you're after.`,
    }));
}
