"use server";

import { act } from "@/lib/server/action";
import { row } from "@/lib/server/database";
import { chatConversations, chatMessages, chatUnreadTotal, peopleInfo } from "@/lib/server/queries";
import type { ChatMessage } from "@/lib/types";

export async function fetchChatOverview() {
  return act(null, async (tx, me) => ({
    conversations: await chatConversations(tx, me.id),
    people: await peopleInfo(tx),
  }));
}

export async function fetchChatMessages(conversation: string, before: string | null) {
  return act(null, (tx) => chatMessages(tx, conversation, before));
}

export async function sendChatMessage(to: string | null, body: string) {
  return act(null, async (tx) =>
    (await row<ChatMessage>(
      tx,
      "select id, conversation, sender_id, body, created_at from public.send_chat_message($1, $2)",
      [to, body.slice(0, 2000)],
    ))!,
  );
}

export async function markChatRead(conversation: string) {
  return act(null, async (tx) => {
    await tx.query("select public.mark_chat_read($1)", [conversation]);
    return true;
  });
}

export async function fetchChatUnread() {
  return act(null, (tx, me) => chatUnreadTotal(tx, me.id));
}
