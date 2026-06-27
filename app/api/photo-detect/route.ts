import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";

// ============================================================================
// Server-side ONLY person DETECTION for the isolated "Group Photo" feature.
//
// Gemini Vision is used to COUNT people in a group photo and return approximate
// NORMALIZED coordinates of where each person is. It does NOT — and must not —
// identify, name, or describe anyone. Identity is attached only when a user
// self-claims a spot in the UI. The API key stays server-side.
//
// Demo-safe: on ANY failure we return { points: [] } (HTTP 200 where possible)
// so the page degrades gracefully to manual tap-to-add and never crashes.
// ============================================================================

// Firebase/Gemini SDKs want the Node runtime (not Edge). Never cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
const MAX_POINTS = 60;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB — skip absurdly large inputs.

let client: GoogleGenAI | undefined;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

// NaN-safe clamp to [0,1] (NaN / -Infinity -> 0, Infinity -> 1).
const clamp01 = (n: number) => (n > 1 ? 1 : n > 0 ? n : 0);

// SSRF guard: only fetch images from Google/Firebase Storage hosts, never an
// arbitrary client-supplied URL (blocks localhost, cloud-metadata IPs, etc.).
function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return (
      h === "firebasestorage.googleapis.com" ||
      h === "storage.googleapis.com" ||
      h.endsWith(".firebasestorage.app") ||
      h.endsWith(".googleusercontent.com")
    );
  } catch {
    return false;
  }
}

// Mirror lib/gemini.ts: tolerate ```json fences / stray prose around the JSON.
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

type Point = { x: number; y: number };

function extractPoints(parsed: unknown): Point[] {
  const people =
    parsed && typeof parsed === "object"
      ? (parsed as { people?: unknown }).people
      : null;
  if (!Array.isArray(people)) return [];
  const out: Point[] = [];
  for (const p of people) {
    if (!p || typeof p !== "object") continue;
    const o = p as { x?: unknown; y?: unknown };
    if (typeof o.x !== "number" || typeof o.y !== "number") continue;
    if (Number.isNaN(o.x) || Number.isNaN(o.y)) continue;
    out.push({ x: clamp01(o.x), y: clamp01(o.y) });
    if (out.length >= MAX_POINTS) break;
  }
  return out;
}

const PROMPT = [
  "You are a person DETECTOR for a group photo taken at the end of a hackathon.",
  "Detect each distinct person visible in the image. For each person, return ONE",
  "point located near the center of their head/face.",
  "Use NORMALIZED coordinates: x and y are fractions from 0.0 to 1.0, where",
  "x = 0 is the left edge, x = 1 is the right edge, y = 0 is the top edge, and",
  "y = 1 is the bottom edge.",
  "Do NOT identify, name, recognize, or describe anyone. Only output the",
  "LOCATIONS of people. If unsure about a person, omit them.",
  'Return strict JSON of the form {"people":[{"x":0.5,"y":0.5}]}.',
].join("\n");

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { imageUrl?: unknown };
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";
    if (!imageUrl) {
      return NextResponse.json(
        { points: [], error: "imageUrl is required" },
        { status: 400 },
      );
    }
    if (!isAllowedImageUrl(imageUrl)) {
      return NextResponse.json(
        { points: [], error: "imageUrl is not an allowed Storage URL" },
        { status: 400 },
      );
    }

    // Fetch the already-uploaded image server-side and inline it to Gemini.
    // Keeps the request body tiny and keeps the key off the client. Bounded by
    // a timeout so a slow/hanging URL can't stall the request.
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) });
    if (!imgRes.ok) {
      console.error("[/api/photo-detect] image fetch failed:", imgRes.status);
      return NextResponse.json({ points: [], error: "image_fetch_failed" });
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ points: [], error: "image_unusable" });
    }
    const ct = (imgRes.headers.get("content-type") ?? "").split(";")[0].trim();
    const mimeType = ct.startsWith("image/") ? ct : "image/jpeg";

    const res = await getClient().models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: buf.toString("base64") } },
            { text: PROMPT },
          ],
        },
      ],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            people: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                },
                required: ["x", "y"],
              },
            },
          },
          required: ["people"],
        },
      },
    });

    const points = extractPoints(safeParse(res.text ?? ""));
    return NextResponse.json({ points });
  } catch (err) {
    console.error("[/api/photo-detect] error:", err);
    // Demo-safe: empty points -> page falls back to manual tap-to-add.
    return NextResponse.json({ points: [], error: "detection_failed" });
  }
}
