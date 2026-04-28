/**
 * Downloads Wikimedia images for timeline_events and re-hosts them in
 * Supabase Storage under timeline/{id}.jpg, then updates image_url in DB.
 *
 * Usage: node scripts/download-timeline-images.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";

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

const SUPABASE_URL      = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const SUPABASE_SERVICE  = envVars["SUPABASE_SERVICE_ROLE_KEY"];
const BUCKET            = "question-images";
const STORAGE_FOLDER    = "timeline";

if (!SUPABASE_URL || !SUPABASE_SERVICE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// ─── Supabase client (service role — bypasses RLS) ───────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isWikimedia(url) {
  return typeof url === "string" && url.startsWith("https://upload.wikimedia.org/");
}

function isAlreadyStorage(url) {
  return typeof url === "string" && url.includes("supabase") && url.includes(STORAGE_FOLDER);
}

function downloadImage(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 6) return reject(new Error("Too many redirects"));
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(
      url,
      {
        headers: {
          "User-Agent":  "StoryGuessr/1.0 (gaultierremi@gmail.com) node-https",
          "Accept":      "image/webp,image/apng,image/*,*/*;q=0.8",
          "Referer":     "https://commons.wikimedia.org/",
          "Accept-Encoding": "identity",
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).toString();
          res.resume();
          return downloadImage(next, redirects + 1).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const contentType = res.headers["content-type"] ?? "image/jpeg";
        if (!contentType.startsWith("image/")) {
          res.resume();
          return reject(new Error(`Not an image (${contentType})`));
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end",  () => resolve({ buffer: Buffer.concat(chunks), contentType }));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
  });
}

function storagePathFor(id) {
  return `${STORAGE_FOLDER}/${id}.jpg`;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const { data: events, error } = await supabase
  .from("timeline_events")
  .select("id, title, image_url");

if (error) {
  console.error("Failed to fetch timeline_events:", error.message);
  process.exit(1);
}

console.log(`Found ${events.length} events.\n`);

let ok = 0, skipped = 0, failed = 0;

for (const ev of events) {
  const { id, title, image_url } = ev;
  const label = `[${title.slice(0, 40)}]`;

  if (!image_url) {
    console.log(`${label} — no image_url, skipping.`);
    skipped++;
    continue;
  }

  if (isAlreadyStorage(image_url)) {
    console.log(`${label} — already in Storage, skipping.`);
    skipped++;
    continue;
  }

  if (!isWikimedia(image_url)) {
    console.log(`${label} — not a Wikimedia URL (${image_url}), skipping.`);
    skipped++;
    continue;
  }

  try {
    process.stdout.write(`${label} — downloading... `);
    const { buffer, contentType } = await downloadImage(image_url);
    console.log(`${(buffer.byteLength / 1024).toFixed(0)} KB`);

    const storagePath = storagePathFor(id);

    process.stdout.write(`  uploading to ${BUCKET}/${storagePath}... `);
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
      });

    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
    console.log("done.");

    // Build the public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    const { error: updErr } = await supabase
      .from("timeline_events")
      .update({ image_url: publicUrl })
      .eq("id", id);

    if (updErr) throw new Error(`DB update failed: ${updErr.message}`);
    console.log(`  → ${publicUrl}`);
    ok++;

  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    failed++;
  }
}

console.log(`\nDone. ✓ ${ok} uploaded, ↷ ${skipped} skipped, ✗ ${failed} failed.`);
