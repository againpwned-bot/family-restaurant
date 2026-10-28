import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ChatPage } from "@/components/chat/chat-page";
import { requireProfile } from "@/lib/auth/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat");
  return { title: t("title") };
}

export default async function ClientChatPage({ searchParams }: PageProps<"/chat">) {
  const me = await requireProfile({ roles: ["owner", "client"] });
  return <ChatPage me={me} conversation={(await searchParams).c} />;
}
