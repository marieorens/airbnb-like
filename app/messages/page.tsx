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
  const user = await getCurrentUser();

  if (!user) {
    return (
      <EmptyState
        title="Connexion requise"
        subtitle="Connectez-vous pour accéder à vos messages."
      />
    );
  }

  return (
    <section className="main-container">
      <Heading
        title="Messages"
        subtitle="Vos échanges avec les annonceurs et les voyageurs."
        backBtn
      />
      <div className="mt-6 md:mt-8">
        <MessagesClient userId={user.id} initialConversationId={searchParams?.c} />
      </div>
    </section>
  );
}
