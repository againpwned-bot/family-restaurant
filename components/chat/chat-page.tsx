import { getTranslations } from "next-intl/server";

import { ChatView } from "@/components/chat/chat-view";
import { PageHeader } from "@/components/layout/page-header";
import type { Profile } from "@/lib/types";
import { asUser } from "@/lib/server/db";
import { chatConversations, chatMessages, peopleInfo } from "@/lib/server/queries";

const CONVERSATION = /^(all|dm:[0-9a-f-]{36}:[0-9a-f-]{36})$/;

export async function ChatPage({ me, conversation }: { me: Profile; conversation: unknown }) {
  const t = await getTranslations("chat");
  const open = typeof conversation === "string" && CONVERSATION.test(conversation) ? conversation : null;
  const data = await asUser(me.id, async (tx) => ({
    conversations: await chatConversations(tx, me.id),
    people: await peopleInfo(tx),
    messages: open ? await chatMessages(tx, open, null) : [],
  }));

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} className="max-lg:mb-4" />
      <ChatView
        meId={me.id}
        basePath={me.role === "admin" ? "/admin/chat" : "/chat"}
        initialConversations={data.conversations}
        people={data.people}
        initialOpen={open}
        initialMessages={data.messages}
      />
    </>
  );
}
