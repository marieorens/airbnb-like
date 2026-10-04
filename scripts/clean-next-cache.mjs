import { rmSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Nettoie les caches de build.
 *
 * `.next/types` contient des fichiers generes que `tsconfig.json` inclut.
 * `tsconfig.tsbuildinfo` memorise cette liste : si on efface `.next` sans
 * l'effacer lui, TypeScript reclame des fichiers disparus et le build echoue
 * sur « Root file specified for compilation ». Les deux vont donc ensemble.
 */
const targets = [".next", "tsconfig.tsbuildinfo"];

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
