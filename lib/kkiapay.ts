const SANDBOX_API_URL = "https://api-sandbox.kkiapay.me";
const LIVE_API_URL = "https://api.kkiapay.me";

export type KkiapayTransaction = {
  transactionId: string;
  status: string;
  amount: number;
  partnerId?: string | null;
  /** Donnee libre transmise au widget. On y met l'identifiant de reservation. */
  data?: string | null;
  failureMessage?: string | null;
};

export function isKkiapaySandbox(): boolean {
  return (process.env.KKIAPAY_SANDBOX ?? "").toLowerCase() === "true";
}

/** Cle publique : elle identifie le compte marchand dans le widget. */
export function getKkiapayPublicKey(): string {
  return (process.env.KKIAPAY_PUBLIC_KEY ?? "").trim();
}

/**
 * La verification serveur exige les trois cles. Sans elles, le paiement peut
 * etre encaisse par le widget mais la reservation ne doit jamais etre confirmee.
 */
export function hasKkiapayVerificationKeys(): boolean {
  return Boolean(
    (process.env.KKIAPAY_PUBLIC_KEY ?? "").trim() &&
      (process.env.KKIAPAY_PRIVATE_KEY ?? "").trim() &&
      (process.env.KKIAPAY_SECRET_KEY ?? "").trim()
  );
}

/**
 * Statut d'une transaction Kkiapay.
 *
 * Le client ne fait jamais foi : seul le retour de cette API, signe par nos
 * cles serveur, permet de confirmer une reservation.
 */
export async function verifyKkiapayTransaction(
  transactionId: string
): Promise<KkiapayTransaction> {
  const publicKey = (process.env.KKIAPAY_PUBLIC_KEY ?? "").trim();
  const privateKey = (process.env.KKIAPAY_PRIVATE_KEY ?? "").trim();
  const secretKey = (process.env.KKIAPAY_SECRET_KEY ?? "").trim();

  if (!publicKey || !privateKey || !secretKey) {
    throw new Error(
      "La verification Kkiapay n'est pas configuree sur le serveur."
    );
  }

  const baseUrl = isKkiapaySandbox() ? SANDBOX_API_URL : LIVE_API_URL;

  const response = await fetch(`${baseUrl}/api/v1/transactions/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": publicKey,
      "X-PRIVATE-KEY": privateKey,
      "X-SECRET-KEY": secretKey,
    },
    body: JSON.stringify({ transactionId }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await response.json().catch(() => null)) as
    | (Record<string, unknown> & { data?: unknown })
    | null;

  if (!response.ok || !payload) {
    throw new Error("Impossible de verifier le paiement aupres de Kkiapay.");
  }

  // Certaines versions de l'API enveloppent la transaction dans `data`.
  const transaction = (
    payload.data && typeof payload.data === "object" ? payload.data : payload
  ) as Partial<KkiapayTransaction>;

  if (!transaction.status) {
    throw new Error("Reponse Kkiapay invalide.");
  }

  return {
    transactionId: transaction.transactionId ?? transactionId,
    status: transaction.status,
    amount: Number(transaction.amount ?? 0),
    partnerId: transaction.partnerId ?? null,
    data: typeof transaction.data === "string" ? transaction.data : null,
    failureMessage: transaction.failureMessage ?? null,
  };
}
