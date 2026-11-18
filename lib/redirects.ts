/**
 * Verifie qu'une URL de retour appartient bien a l'application.
 *
 * Les liens profonds de l'application mobile (`vacationhub://`, `exp://`) sont
 * acceptes tels quels. Pour le web, on compare l'origine exacte : un simple
 * `startsWith` laisserait passer `https://vacationhub.example.evil.com`.
 */
export function isAllowedRedirect(
  url: unknown,
  requestOrigin?: string
): url is string {
  if (typeof url !== "string" || !url) return false;

  if (url.startsWith("vacationhub://") || url.startsWith("exp://")) {
    return true;
  }

  const envOrigin = (process.env.NEXT_PUBLIC_SERVER_URL ?? "").replace(/\/+$/, "");

  try {
    const origin = new URL(url).origin;
    return (
      (Boolean(requestOrigin) && origin === requestOrigin) ||
      (Boolean(envOrigin) && origin === envOrigin)
    );
  } catch {
    return false;
  }
}
