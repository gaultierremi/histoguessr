/**
 * Generates a fun_fact for every approved timeline_events row where fun_fact IS NULL.
 * Uses claude-haiku-4-5-20251001 via the Anthropic Messages API (native fetch, no SDK).
 *
 * Usage: node scripts/generate-fun-facts.mjs
 * Requires in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Load .env.local ──────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");
const envVars = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const SUPABASE_URL     = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const SUPABASE_SERVICE = envVars["SUPABASE_SERVICE_ROLE_KEY"];
const ANTHROPIC_KEY    = envVars["ANTHROPIC_API_KEY"];

if (!SUPABASE_URL || !SUPABASE_SERVICE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!ANTHROPIC_KEY) {
  console.error("Missing ANTHROPIC_API_KEY in .env.local");
  process.exit(1);
}

// ─── Supabase client ──────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

// ─── Anthropic helper ─────────────────────────────────────────────────────────

async function generateFunFact(title, year) {
  const label = year < 0 ? `${Math.abs(year)} av. J.-C.` : String(year);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":         "application/json",
      "x-api-key":            ANTHROPIC_KEY,
      "anthropic-version":    "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 120,
      system:
        "Tu es un historien passionné. Réponds uniquement avec une seule phrase courte (max 150 caractères), surprenante et peu connue sur l'événement historique donné. Pas de guillemets, pas de ponctuation finale.",
      messages: [
        { role: "user", content: `${title} (${label})` },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text?.trim();
  if (!text) throw new Error("Empty response from Anthropic");

  // Truncate hard at 150 chars just in case
  return text.slice(0, 150);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const { data: events, error } = await supabase
  .from("timeline_events")
  .select("id, title, year")
  .is("fun_fact", null)
  .order("year", { ascending: true });

if (error) {
  console.error("Failed to fetch events:", error.message);
  process.exit(1);
}

console.log(`Found ${events.length} events without fun_fact.\n`);

let ok = 0, failed = 0;

for (const ev of events) {
  const label = `[${ev.title.slice(0, 45)}]`;
  try {
    const funFact = await generateFunFact(ev.title, ev.year);

    const { error: updErr } = await supabase
      .from("timeline_events")
      .update({ fun_fact: funFact })
      .eq("id", ev.id);

    if (updErr) throw new Error(`DB update: ${updErr.message}`);

    console.log(`✓ ${label}\n  → "${funFact}"\n`);
    ok++;
  } catch (err) {
    console.error(`✗ ${label} — ${err.message}\n`);
    failed++;
  }

  if (ok + failed < events.length) await sleep(500);
}

console.log(`Done. ✓ ${ok} générés, ✗ ${failed} échoués.`);
