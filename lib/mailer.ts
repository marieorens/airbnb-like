import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envoi d'emails transactionnels via SMTP Gmail.
 *
 * Choix volontairement minimal : un mot de passe d'application suffit, aucun
 * domaine a verifier, aucun DNS a configurer. Tout l'envoi passe par ce seul
 * module : changer de fournisseur plus tard ne touchera que ce fichier.
 */

let cachedTransporter: Transporter | null = null;

/**
 * Google affiche le mot de passe d'application en 4 groupes de 4 separes par
 * des espaces : c'est un decoupage visuel, le secret fait 16 caracteres. On
 * retire donc les espaces, ici et nulle part ailleurs.
 */
const readAppPassword = () => process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "") || "";

function getTransporter() {
  const user = process.env.GMAIL_USER?.trim();
  const pass = readAppPassword();

  if (!user || !pass) {
    throw new Error("Missing GMAIL_USER or GMAIL_APP_PASSWORD");
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });
  }

  return cachedTransporter;
}

export const isMailerConfigured = () =>
  Boolean(process.env.GMAIL_USER?.trim() && readAppPassword());

export async function sendEmail({
  to,
  subject,
  html,
  text,
  refId,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Identifiant unique du contenu, pour que Gmail ne replie pas les emails. */
  refId?: string;
}) {
  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from: `VacationHub <${process.env.GMAIL_USER?.trim()}>`,
    to,
    subject,
    text,
    html,
    // Sans cet en-tete, Gmail masque les messages qu'il juge trop semblables
    // sous un « afficher le contenu similaire ». Comme chaque message declenche
    // desormais un email, ils se ressemblent beaucoup.
    headers: refId ? { "X-Entity-Ref-ID": refId } : undefined,
  });

  // `response` porte la reponse brute du serveur SMTP, utile dans les logs.
  return { messageId: info.messageId, response: info.response };
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

type Locale = "fr" | "en";

/** Textes de l'email « nouveau message », dans chaque langue. */
const newMessageCopy: Record<
  Locale,
  {
    heading: (sender: string) => string;
    about: (listing: string) => string;
    cta: string;
    footer: string;
    text: (sender: string, listing: string, body: string, url: string) => string;
  }
> = {
  fr: {
    heading: (sender) => `${sender} vous a écrit`,
    about: (listing) => `À propos de « ${listing} »`,
    cta: "Répondre sur VacationHub",
    footer:
      "Vous recevez cet email parce qu’une conversation est ouverte sur une de vos annonces ou sur une annonce que vous avez contactée.",
    text: (sender, listing, body, url) =>
      `${sender} vous a envoyé un message au sujet de « ${listing} ».\n\n${body}\n\nRépondre : ${url}`,
  },
  en: {
    heading: (sender) => `${sender} sent you a message`,
    about: (listing) => `About “${listing}”`,
    cta: "Reply on VacationHub",
    footer:
      "You’re receiving this email because a conversation is open on one of your listings or on a listing you contacted.",
    text: (sender, listing, body, url) =>
      `${sender} sent you a message about “${listing}”.\n\n${body}\n\nReply: ${url}`,
  },
};

/**
 * Gabarit de l'email « nouveau message », bilingue : la langue du destinataire
 * n'est enregistrée nulle part, on écrit donc en français puis en anglais.
 * Le message de l'expéditeur, lui, n'apparaît qu'une fois, tel qu'il l'a écrit.
 */
export function newMessageEmail({
  senderName,
  listingTitles,
  body,
  conversationUrls,
}: {
  /** `null` : membre sans nom, remplacé par un libellé dans chaque langue. */
  senderName: string | null;
  /** Titre de l'annonce dans chaque langue (identiques si non traduite). */
  listingTitles: Record<Locale, string>;
  body: string;
  /** Lien vers la conversation, dans la version du site de chaque langue. */
  conversationUrls: Record<Locale, string>;
}) {
  const senders: Record<Locale, string> = {
    fr: senderName || "Un membre VacationHub",
    en: senderName || "A VacationHub member",
  };
  const safeBody = escapeHtml(body).replace(/\n/g, "<br />");

  const section = (locale: Locale) => {
    const copy = newMessageCopy[locale];
    return `
        <div lang="${locale}">
          <h1 style="font-size: 20px; font-weight: 900; margin: 12px 0 4px;">
            ${escapeHtml(copy.heading(senders[locale]))}
          </h1>
          <p style="font-size: 14px; color: #737373; margin: 0 0 16px;">
            ${escapeHtml(copy.about(listingTitles[locale]))}
          </p>
          <p style="margin: 0 0 8px;">
            <a href="${conversationUrls[locale]}"
               style="display: inline-block; background: #e11d48; color: #ffffff; text-decoration: none;
                      font-weight: 700; font-size: 14px; padding: 12px 20px; border-radius: 10px;">
              ${copy.cta}
            </a>
          </p>
        </div>`;
  };

  return {
    subject: `${senderName ? `${senderName} · ` : ""}Nouveau message · New message — ${listingTitles.fr}`,
    text: [
      newMessageCopy.fr.text(senders.fr, listingTitles.fr, body, conversationUrls.fr),
      "———",
      newMessageCopy.en.text(senders.en, listingTitles.en, body, conversationUrls.en),
    ].join("\n\n"),
    html: `
      <div style="font-family: Nunito, Arial, sans-serif; color: #0a0a0a; max-width: 520px;">
        <p style="font-size: 12px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #e11d48; margin: 0;">
          VacationHub
        </p>
        <div style="border-left: 3px solid #e11d48; padding: 4px 0 4px 14px; margin: 16px 0 8px; font-size: 15px; line-height: 22px;">
          ${safeBody}
        </div>
        ${section("fr")}
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0 8px;" />
        ${section("en")}
        <p style="font-size: 12px; color: #a3a3a3; margin-top: 28px;">
          ${newMessageCopy.fr.footer}<br />
          <span lang="en">${newMessageCopy.en.footer}</span>
        </p>
      </div>
    `,
  };
}

// Décision sur un dossier de vérification ----------------------------------------

export type VerificationReason =
  | "unreadable"
  | "expired"
  | "name_mismatch"
  | "incomplete"
  | "wrong_document"
  | "company_mismatch";

/** Libellés des motifs de refus, mêmes codes que `profiles.verification_reasons`. */
export const verificationReasonLabels: Record<VerificationReason, Record<Locale, string>> = {
  unreadable: {
    fr: "Un document est illisible ou flou.",
    en: "A document is unreadable or blurry.",
  },
  expired: { fr: "Un document est expiré.", en: "A document has expired." },
  name_mismatch: {
    fr: "Le nom sur le document ne correspond pas à votre profil.",
    en: "The name on the document doesn’t match your profile.",
  },
  incomplete: {
    fr: "Un document est manquant ou incomplet.",
    en: "A document is missing or incomplete.",
  },
  wrong_document: {
    fr: "Un document ne correspond pas à celui demandé.",
    en: "A document isn’t the one requested.",
  },
  company_mismatch: {
    fr: "Les documents ne correspondent pas à l’agence déclarée.",
    en: "The documents don’t match the agency you declared.",
  },
};

/**
 * Email envoyé après la décision de la modération, bilingue comme les autres :
 * la langue du destinataire n'est enregistrée nulle part.
 */
export function verificationDecisionEmail({
  name,
  approved,
  reasons,
  note,
  urls,
}: {
  name: string | null;
  approved: boolean;
  reasons: VerificationReason[];
  note: string | null;
  /** Lien vers la page de vérification (refus) ou l'accueil (validation), par langue. */
  urls: Record<Locale, string>;
}) {
  const copy = {
    fr: approved
      ? {
          heading: "Votre compte est vérifié",
          text: "Bonne nouvelle : notre équipe a validé votre identité. Vous pouvez désormais publier vos biens sur VacationHub.",
          cta: "Publier un bien",
          reasonsTitle: "",
          noteTitle: "",
        }
      : {
          heading: "Votre dossier doit être complété",
          text: "Notre équipe n’a pas pu valider votre identité pour le moment. Corrigez les points ci-dessous puis renvoyez votre dossier.",
          cta: "Renvoyer mon dossier",
          reasonsTitle: "Motifs",
          noteTitle: "Précisions de notre équipe",
        },
    en: approved
      ? {
          heading: "Your account is verified",
          text: "Good news: our team has confirmed your identity. You can now list your properties on VacationHub.",
          cta: "List a property",
          reasonsTitle: "",
          noteTitle: "",
        }
      : {
          heading: "Your documents need another look",
          text: "Our team couldn’t confirm your identity yet. Fix the points below, then submit your documents again.",
          cta: "Resubmit my documents",
          reasonsTitle: "Reasons",
          noteTitle: "Notes from our team",
        },
  };

  const greeting = { fr: name ? `Bonjour ${name},` : "Bonjour,", en: name ? `Hello ${name},` : "Hello," };

  const section = (locale: Locale) => {
    const c = copy[locale];
    const reasonItems = reasons
      .map((reason) => `<li style="margin: 0 0 6px;">${escapeHtml(verificationReasonLabels[reason][locale])}</li>`)
      .join("");
    return `
        <div lang="${locale}">
          <h1 style="font-size: 20px; font-weight: 900; margin: 12px 0 8px;">${c.heading}</h1>
          <p style="font-size: 14px; color: #404040; margin: 0 0 8px;">${escapeHtml(greeting[locale])}</p>
          <p style="font-size: 14px; color: #404040; line-height: 22px; margin: 0 0 12px;">${c.text}</p>
          ${
            reasonItems
              ? `<p style="font-size: 13px; font-weight: 900; margin: 12px 0 6px;">${c.reasonsTitle}</p>
                 <ul style="font-size: 14px; color: #404040; padding-left: 18px; margin: 0 0 12px;">${reasonItems}</ul>`
              : ""
          }
          ${
            !approved && note
              ? `<p style="font-size: 13px; font-weight: 900; margin: 12px 0 6px;">${c.noteTitle}</p>
                 <div style="border-left: 3px solid #e11d48; padding: 4px 0 4px 14px; font-size: 14px; line-height: 22px; color: #404040;">${escapeHtml(note).replace(/\n/g, "<br />")}</div>`
              : ""
          }
          <p style="margin: 20px 0 8px;">
            <a href="${urls[locale]}"
               style="display: inline-block; background: #e11d48; color: #ffffff; text-decoration: none;
                      font-weight: 700; font-size: 14px; padding: 12px 20px; border-radius: 10px;">
              ${c.cta}
            </a>
          </p>
        </div>`;
  };

  const text = (["fr", "en"] as const)
    .map((locale) => {
      const c = copy[locale];
      const lines = [greeting[locale], "", c.heading, c.text];
      if (reasons.length) {
        lines.push("", `${c.reasonsTitle} :`, ...reasons.map((r) => `- ${verificationReasonLabels[r][locale]}`));
      }
      if (!approved && note) lines.push("", `${c.noteTitle} :`, note);
      lines.push("", `${c.cta} : ${urls[locale]}`);
      return lines.join("\n");
    })
    .join("\n\n———\n\n");

  return {
    subject: approved
      ? "Votre compte est vérifié · Your account is verified — VacationHub"
      : "Votre dossier de vérification · Your verification documents — VacationHub",
    text,
    html: `
      <div style="font-family: Nunito, Arial, sans-serif; color: #0a0a0a; max-width: 520px;">
        <p style="font-size: 12px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #e11d48; margin: 0;">
          VacationHub
        </p>
        ${section("fr")}
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0 8px;" />
        ${section("en")}
      </div>
    `,
  };
}
