import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ChatPage } from "@/components/chat/chat-page";
import { requireProfile } from "@/lib/auth/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat");
  return { title: t("title") };
}

export default async function AdminChatPage({ searchParams }: PageProps<"/admin/chat">) {
  const me = await requireProfile({ roles: ["owner", "admin"] });
  return <ChatPage me={me} conversation={(await searchParams).c} />;
}
