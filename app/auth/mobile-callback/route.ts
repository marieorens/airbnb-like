/**
 * Relais du retour Google vers l'application mobile.
 *
 * Supabase refusait de renvoyer directement vers l'adresse de l'app
 * (`exp://…` en Expo Go, `vacationhub://…` une fois publiée) et retombait sur
 * l'accueil du site. Le mobile demande donc à Supabase de revenir ici, sur le
 * domaine du site, toujours accepté, en précisant l'adresse de l'app dans
 * `return`. Cette route relance aussitôt l'app avec le code reçu.
 *
 * Sécurité :
 *   - on ne renvoie que vers les schémas de l'app, jamais vers un site web,
 *     pour que la route ne serve pas à rediriger vers une page piège ;
 *   - le code seul ne vaut rien : en PKCE, il ne s'échange qu'avec le secret
 *     (`code_verifier`) resté dans l'app qui a lancé la connexion.
 */

const ALLOWED_SCHEMES = ["exp:", "exps:", "vacationhub:"];

/** Adresse de l'app validée, ou `null` si elle n'est pas un retour d'app autorisé. */
function appReturnUrl(value: string | null): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ALLOWED_SCHEMES.includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

export function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const target = appReturnUrl(searchParams.get("return"));

  // Adresse de retour absente ou non autorisée : on ne relaie rien.
  if (!target) {
    return Response.redirect(`${origin}/`, 302);
  }

  // On transmet le code, ou l'erreur si Google ou Supabase ont refusé.
  for (const key of ["code", "error", "error_code", "error_description"]) {
    const value = searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }

  // `Response.redirect` n'accepte que http(s) : en-tête Location écrit à la main.
  // La fenêtre de connexion de l'app intercepte cette adresse et se ferme.
  return new Response(null, {
    status: 302,
    headers: { Location: target.toString(), "Cache-Control": "no-store" },
  });
}
