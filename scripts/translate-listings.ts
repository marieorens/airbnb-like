/**
 * Rattrapage : traduit en français et en anglais les annonces qui ne le sont pas encore.
 *
 *   npx tsx --env-file=.env.local scripts/translate-listings.ts            # tout
 *   npx tsx --env-file=.env.local scripts/translate-listings.ts --dry-run  # compter seulement
 *
 * Exécution locale uniquement : utilise SUPABASE_SERVICE_ROLE_KEY et
 * DEEPL_API_KEY du fichier d'environnement du web. Rejouable sans risque :
 * seules les annonces dont `translations` est vide sont traitées.
 */
import { createClient } from "@supabase/supabase-js";

import { isTranslationConfigured, translateListingText } from "../lib/listing-translation";
import type { Database } from "../types/supabase";

const BATCH = 20;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  }
  if (!dryRun && !isTranslationConfigured()) {
    throw new Error("DEEPL_API_KEY est requis.");
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("translations", "{}");

  console.log(`${count ?? 0} annonce(s) à traduire.`);
  if (dryRun || !count) return;

  let done = 0;
  let failed = 0;
  const skipped = new Set<string>();

  for (;;) {
    let query = supabase
      .from("listings")
      .select("id, title, description")
      .eq("translations", "{}")
      .order("created_at", { ascending: false })
      .limit(BATCH);
    if (skipped.size) query = query.not("id", "in", `(${Array.from(skipped).join(",")})`);

    const { data: rows, error } = await query;
    if (error) throw error;
    if (!rows?.length) break;

    for (const row of rows) {
      const translations = await translateListingText(row);
      if (!translations) {
        // On ne retente pas une annonce en échec pendant ce passage.
        skipped.add(row.id);
        failed += 1;
        console.warn(`  échec : ${row.id}`);
        continue;
      }

      const { error: updateError } = await supabase
        .from("listings")
        .update({ translations })
        .eq("id", row.id);

      if (updateError) {
        skipped.add(row.id);
        failed += 1;
        console.warn(`  échec d'enregistrement : ${row.id} — ${updateError.message}`);
      } else {
        done += 1;
        console.log(`  ${done}/${count} ${row.title}`);
      }
    }
  }

  console.log(`Terminé : ${done} traduite(s), ${failed} échec(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
