import { rmSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Nettoie les caches de build.
 *
 * Par defaut, seul `tsconfig.tsbuildinfo` est efface. C'est lui qui cause
 * l'erreur « Root file specified for compilation » : il memorise la liste des
 * fichiers generes dans `.next/types`, et les reclame meme apres leur
 * disparition.
 *
 * `.next` n'est efface qu'avec `--all`. Le supprimer avant chaque build le
 * rend instable sous Windows : l'antivirus scanne l'arborescence pendant que
 * Next la reecrit, et la collecte des pages echoue en ENOENT.
 */
const full = process.argv.includes("--all");
const targets = full ? [".next", "tsconfig.tsbuildinfo"] : ["tsconfig.tsbuildinfo"];

for (const target of targets) {
  const path = resolve(process.cwd(), target);

  try {
    rmSync(path, { recursive: true, force: true });
    console.log(`Cleaned: ${target}`);
  } catch (error) {
    console.error(
      `Could not clean ${target}. Stop any running dev or start server, then try again.`
    );
    console.error(error);
    process.exit(1);
  }
}
