import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = "timeline-events";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getExtension(contentType) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("svg")) return "svg";
  return "jpg";
}

async function getWikipediaImageUrl(pageTitle) {
  const apiUrl =
    "https://fr.wikipedia.org/api/rest_v1/page/summary/" +
    encodeURIComponent(pageTitle);

  const res = await fetch(apiUrl, {
    headers: {
      "User-Agent": "Histoguessr image importer / local admin script"
    }
  });

  if (!res.ok) {
    throw new Error(`Wikipedia failed: ${res.status}`);
  }

  const data = await res.json();
  const imageUrl = data.originalimage?.source || data.thumbnail?.source;

  if (!imageUrl) {
    throw new Error("Aucune image Wikipedia trouvée");
  }

  return imageUrl;
}

async function downloadImage(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Histoguessr image importer / local admin script"
    }
  });

  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "image/jpeg";

  if (!contentType.startsWith("image/")) {
    throw new Error(`Not an image: ${contentType}`);
  }

  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType,
    extension: getExtension(contentType)
  };
}

async function main() {
  const raw = await fs.readFile("./timeline-images.json", "utf8");
  const events = JSON.parse(raw);

  let updatedCount = 0;
  let insertedCount = 0;
  let errorCount = 0;

  for (const event of events) {
    try {
      console.log(`\n⏳ ${event.title}`);

      const sourceImageUrl =
        event.image_url || (await getWikipediaImageUrl(event.wiki || event.title));

      await sleep(1500);

      const image = await downloadImage(sourceImageUrl);

      const filePath = `events/${event.year}-${slugify(event.title)}.${image.extension}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, image.buffer, {
          contentType: image.contentType,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      const imageUrl = data.publicUrl;

      const match = event.match || event.title;

      const { data: existingRows, error: findError } = await supabase
        .from("timeline_events")
        .select("id, title")
        .ilike("title", `%${match}%`);

      if (findError) throw findError;

      if (existingRows && existingRows.length > 0) {
        const ids = existingRows.map((row) => row.id);

        const { error: updateError } = await supabase
          .from("timeline_events")
          .update({ image_url: imageUrl })
          .in("id", ids);

        if (updateError) throw updateError;

        updatedCount += existingRows.length;

        console.log(`✅ UPDATE OK`);
        console.log(`   Rows updated: ${existingRows.length}`);
        console.log(`   URL: ${imageUrl}`);
      } else {
        const { error: insertError } = await supabase
          .from("timeline_events")
          .insert({
            title: event.title,
            description: event.description || `Événement historique : ${event.title}.`,
            year: event.year,
            image_url: imageUrl,
            category: event.category || "Histoire générale",
            difficulty: event.difficulty || 1,
            status: "approved"
          });

        if (insertError) throw insertError;

        insertedCount++;

        console.log(`🆕 INSERT OK`);
        console.log(`   Title: ${event.title}`);
        console.log(`   URL: ${imageUrl}`);
      }
    } catch (err) {
      errorCount++;
      console.error(`❌ Erreur pour ${event.title}: ${err.message}`);
    }

    await sleep(10000);
  }

  console.log("\n========== RÉSUMÉ ==========");
  console.log(`✅ Updates: ${updatedCount}`);
  console.log(`🆕 Inserts: ${insertedCount}`);
  console.log(`❌ Erreurs: ${errorCount}`);
  console.log("============================");
}

main();