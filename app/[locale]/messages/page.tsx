import { getTranslations } from "next-intl/server";
import EmptyState from "@/components/EmptyState";
import Heading from "@/components/Heading";
import { getCurrentUser } from "@/services/user";
import MessagesClient from "./_components/MessagesClient";

type MessagesPageProps = {
  searchParams?: {
    c?: string;
  };
};

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const t = await getTranslations("messages");
  const user = await getCurrentUser();

  if (!user) {
    return (
      <EmptyState
        title={t("signInRequired")}
        subtitle={t("signInPrompt")}
      />
    );
  }

  return (
    <section className="main-container">
      <Heading
        title={t("title")}
        subtitle={t("subtitle")}
        backBtn
      />
      <div className="mt-6 md:mt-8">
        <MessagesClient userId={user.id} initialConversationId={searchParams?.c} />
      </div>
    </section>
  );
}
