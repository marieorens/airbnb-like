"use client";

import { useRef, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import {
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineDocumentArrowUp,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";

import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/browser";
import type { CurrentUser } from "@/types/listing";
import type { Tables } from "@/types/supabase";

type DocumentKind = Tables<"verification_documents">["kind"];
type AccountType = CurrentUser["accountType"];
type Status = CurrentUser["verificationStatus"];

export type VerificationDocument = { kind: DocumentKind; storagePath: string };

const BUCKET = "verification-documents";
const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

/** Documents demandés selon le type de compte ; les versos sont facultatifs (passeport). */
const SLOTS: Record<AccountType, { kind: DocumentKind; required: boolean }[]> = {
  individual: [
    { kind: "id_front", required: true },
    { kind: "id_back", required: false },
  ],
  agency: [
    { kind: "rccm", required: true },
    { kind: "ifu", required: true },
    { kind: "manager_id_front", required: true },
    { kind: "manager_id_back", required: false },
  ],
};

/** Même convention que les photos d'annonces : le chemin commence par l'UID. */
const storagePathFor = (userId: string, file: File) => {
  const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
  return `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeFileName}`;
};

interface VerificationClientProps {
  userId: string;
  accountType: AccountType;
  companyName: string | null;
  status: Status;
  note: string | null;
  /** Codes des motifs du dernier refus. */
  reasons: string[];
  documents: VerificationDocument[];
}

const VerificationClient = ({
  userId,
  accountType: initialType,
  companyName: initialCompany,
  status,
  note,
  reasons,
  documents: initialDocuments,
}: VerificationClientProps) => {
  const t = useTranslations("verification");
  const router = useRouter();
  const [isSubmitting, startSubmit] = useTransition();
  const [uploadingKind, setUploadingKind] = useState<DocumentKind | null>(null);
  const [accountType, setAccountType] = useState<AccountType>(initialType);
  const [companyName, setCompanyName] = useState(initialCompany ?? "");
  const [documents, setDocuments] = useState(initialDocuments);
  const inputs = useRef<Partial<Record<DocumentKind, HTMLInputElement | null>>>({});

  // Le dossier n'est modifiable qu'avant l'envoi ou après un refus (règle de la base).
  const editable = status === "unverified" || status === "rejected";
  const pathOf = (kind: DocumentKind) =>
    documents.find((document) => document.kind === kind)?.storagePath;

  const upload = async (kind: DocumentKind, file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error(t("errors.fileType"));
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error(t("errors.fileSize"));
      return;
    }

    setUploadingKind(kind);
    const supabase = createClient();
    const previous = pathOf(kind);
    const path = storagePathFor(userId, file);

    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { error: rowError } = await supabase
        .from("verification_documents")
        .upsert(
          { user_id: userId, kind, storage_path: path },
          { onConflict: "user_id,kind" }
        );
      if (rowError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw rowError;
      }

      // L'ancien fichier n'est plus référencé : on le retire (sans bloquer).
      if (previous) await supabase.storage.from(BUCKET).remove([previous]);

      setDocuments((current) => [
        ...current.filter((document) => document.kind !== kind),
        { kind, storagePath: path },
      ]);
      toast.success(t("uploaded"));
    } catch {
      toast.error(t("errors.upload"));
    } finally {
      setUploadingKind(null);
    }
  };

  /** Le bucket est privé : on ouvre le fichier par un lien valable une minute. */
  const view = async (kind: DocumentKind) => {
    const path = pathOf(kind);
    if (!path) return;
    const { data, error } = await createClient()
      .storage.from(BUCKET)
      .createSignedUrl(path, 60);
    if (error || !data) {
      toast.error(t("errors.view"));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const submit = () => {
    if (accountType === "agency" && !companyName.trim()) {
      toast.error(t("errors.company_name_missing"));
      return;
    }

    startSubmit(async () => {
      const supabase = createClient();

      // Le type de compte est enregistré avant l'envoi : la base vérifie les
      // documents attendus pour ce type.
      if (accountType !== initialType || companyName.trim() !== (initialCompany ?? "")) {
        const { error } = await supabase
          .from("profiles")
          .update({
            account_type: accountType,
            company_name: accountType === "agency" ? companyName.trim() : null,
          })
          .eq("id", userId);
        if (error) {
          toast.error(t("errors.generic"));
          return;
        }
      }

      const { data, error } = await supabase.rpc("submit_verification");
      const code = error ? "generic" : (data ?? "generic");
      if (code !== "ok") {
        toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.generic"));
        return;
      }

      toast.success(t("submitted"));
      router.refresh();
    });
  };

  const banner = {
    unverified: null,
    pending: {
      icon: HiOutlineClock,
      className: "bg-amber-50 text-amber-800 ring-amber-200",
      title: t("status.pending.title"),
      text: t("status.pending.text"),
    },
    approved: {
      icon: HiOutlineCheckCircle,
      className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
      title: t("status.approved.title"),
      text: t("status.approved.text"),
    },
    rejected: {
      icon: HiOutlineExclamationTriangle,
      className: "bg-rose-50 text-rose-800 ring-rose-200",
      title: t("status.rejected.title"),
      text: t("status.rejected.text"),
    },
  }[status];

  return (
    <div className="mt-8 flex flex-col gap-8">
      {banner ? (
        <div className={`flex items-start gap-3 rounded-2xl p-4 ring-1 ${banner.className}`}>
          <banner.icon size={22} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-black">{banner.title}</p>
            <p className="mt-1 text-sm font-medium leading-6">{banner.text}</p>
            {status === "rejected" && reasons.length ? (
              <ul className="mt-2 list-disc pl-5 text-sm font-semibold leading-6">
                {reasons.map((reason) => (
                  <li key={reason}>
                    {t.has(`reasons.${reason}`) ? t(`reasons.${reason}`) : reason}
                  </li>
                ))}
              </ul>
            ) : null}
            {status === "rejected" && note ? (
              <p className="mt-2 text-sm font-medium leading-6">
                {t("status.rejected.note", { note })}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <fieldset disabled={!editable} className="grid gap-3">
        <legend className="mb-3 text-xs font-black uppercase tracking-wide text-neutral-400">
          {t("accountType")}
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["individual", "agency"] as const).map((type) => (
            <label
              key={type}
              className={`flex flex-col gap-1 rounded-2xl border p-4 transition ${
                accountType === type
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 bg-white text-neutral-700"
              } ${editable ? "cursor-pointer hover:border-neutral-500" : "opacity-70"}`}
            >
              <input
                type="radio"
                name="accountType"
                value={type}
                checked={accountType === type}
                onChange={() => setAccountType(type)}
                className="sr-only"
              />
              <span className="text-sm font-black">{t(`accountTypes.${type}`)}</span>
              <span
                className={`text-xs font-medium leading-5 ${
                  accountType === type ? "text-neutral-300" : "text-neutral-500"
                }`}
              >
                {t(`documentsFor.${type}`)}
              </span>
            </label>
          ))}
        </div>
        {accountType === "agency" ? (
          <label className="mt-2 flex flex-col gap-2 text-sm font-bold text-neutral-700">
            {t("companyName")}
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              maxLength={160}
              className="h-11 rounded-xl border border-neutral-200 px-3 text-sm font-semibold text-neutral-950 outline-none transition focus:border-neutral-950 disabled:bg-neutral-50"
            />
          </label>
        ) : null}
      </fieldset>

      <div className="grid gap-3">
        <p className="text-xs font-black uppercase tracking-wide text-neutral-400">
          {t("documents")}
        </p>
        {SLOTS[accountType].map(({ kind, required }) => {
          const sent = Boolean(pathOf(kind));
          const busy = uploadingKind === kind;
          return (
            <div
              key={kind}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-neutral-200 p-4"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                  sent ? "bg-emerald-50 text-emerald-700" : "bg-[#FFF1F2] text-[#E11D48]"
                }`}
              >
                {sent ? <HiOutlineCheckCircle size={22} /> : <HiOutlineDocumentArrowUp size={22} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-neutral-950">
                  {t(`kinds.${kind}`)}
                  {required ? " *" : ` (${t("optional")})`}
                </p>
                <p className="text-xs font-medium text-neutral-500">
                  {sent ? t("sent") : t(`hints.${kind}`)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {sent ? (
                  <button
                    type="button"
                    onClick={() => void view(kind)}
                    className="text-sm font-black text-neutral-600 hover:underline"
                  >
                    {t("view")}
                  </button>
                ) : null}
                {editable ? (
                  <>
                    <input
                      ref={(element) => {
                        inputs.current[kind] = element;
                      }}
                      type="file"
                      accept={ACCEPTED.join(",")}
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void upload(kind, file);
                      }}
                    />
                    <button
                      type="button"
                      disabled={busy || uploadingKind !== null}
                      onClick={() => inputs.current[kind]?.click()}
                      className="h-10 rounded-full border border-neutral-300 px-4 text-sm font-black text-neutral-950 transition hover:border-neutral-950 disabled:opacity-60"
                    >
                      {busy ? t("uploading") : sent ? t("replace") : t("upload")}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
        <p className="text-xs font-medium leading-5 text-neutral-500">{t("privacy")}</p>
      </div>

      {editable ? (
        <button
          type="button"
          onClick={submit}
          disabled={isSubmitting || uploadingKind !== null}
          className="inline-flex h-12 items-center justify-center self-start rounded-full bg-[#E11D48] px-7 text-sm font-black text-white transition hover:bg-[#BE123C] disabled:opacity-60"
        >
          {isSubmitting ? t("submitting") : status === "rejected" ? t("resubmit") : t("submit")}
        </button>
      ) : null}
    </div>
  );
};

export default VerificationClient;
