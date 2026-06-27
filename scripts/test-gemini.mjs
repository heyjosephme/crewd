// Throwaway: verifies GEMINI_API_KEY + model reachability (no heuristic fallback).
// Run: node --env-file=.env.local scripts/test-gemini.mjs
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
if (!apiKey) {
  console.error("NO_KEY: GEMINI_API_KEY is empty");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
try {
  const res = await ai.models.generateContent({
    model,
    contents: "Reply with exactly the word: OK",
  });
  console.log("MODEL:", model);
  console.log("RESPONSE:", JSON.stringify(res.text));
  console.log("GEMINI_OK");
} catch (e) {
  console.error("GEMINI_ERROR:", e?.message || String(e));
  process.exit(2);
}
