import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

// À utiliser à la place de `next/link` et `next/navigation` : ces versions ajoutent
// automatiquement le préfixe de langue (`/en/...`) aux liens et aux redirections.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
