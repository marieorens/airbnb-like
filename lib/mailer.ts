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
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `VacationHub <${process.env.GMAIL_USER?.trim()}>`,
    to,
    subject,
    text,
    html,
  });
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Gabarit de l'email « nouveau message ». */
export function newMessageEmail({
  senderName,
  listingTitle,
  body,
  conversationUrl,
}: {
  senderName: string;
  listingTitle: string;
  body: string;
  conversationUrl: string;
}) {
  const safeBody = escapeHtml(body).replace(/\n/g, "<br />");
  const safeSender = escapeHtml(senderName);
  const safeListing = escapeHtml(listingTitle);

  return {
    subject: `${senderName} vous a écrit — ${listingTitle}`,
    text: `${senderName} vous a envoyé un message au sujet de « ${listingTitle} ».\n\n${body}\n\nRépondre : ${conversationUrl}`,
    html: `
      <div style="font-family: Nunito, Arial, sans-serif; color: #0a0a0a; max-width: 520px;">
        <p style="font-size: 12px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #e11d48; margin: 0;">
          VacationHub
        </p>
        <h1 style="font-size: 20px; font-weight: 900; margin: 12px 0 4px;">
          ${safeSender} vous a écrit
        </h1>
        <p style="font-size: 14px; color: #737373; margin: 0 0 20px;">
          À propos de « ${safeListing} »
        </p>
        <div style="border-left: 3px solid #e11d48; padding: 4px 0 4px 14px; font-size: 15px; line-height: 22px;">
          ${safeBody}
        </div>
        <p style="margin: 28px 0 0;">
          <a href="${conversationUrl}"
             style="display: inline-block; background: #e11d48; color: #ffffff; text-decoration: none;
                    font-weight: 700; font-size: 14px; padding: 12px 20px; border-radius: 10px;">
            Répondre sur VacationHub
          </a>
        </p>
        <p style="font-size: 12px; color: #a3a3a3; margin-top: 28px;">
          Vous recevez cet email parce qu'une conversation est ouverte sur une de vos annonces
          ou sur une annonce que vous avez contactée.
        </p>
      </div>
    `,
  };
}
