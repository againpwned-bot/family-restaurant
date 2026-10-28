"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { fetchChatUnread } from "@/app/actions/chat";
import { useRealtime } from "@/hooks/use-realtime";
import { safe } from "@/lib/action-result";

const ChatUnreadContext = createContext(0);

export const CHAT_READ_EVENT = "app:chat-read";

export function ChatUnreadProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await safe(fetchChatUnread());
    if (typeof data === "number") setCount(data);
  }, []);

  const soon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void refresh(), 400);
  }, [refresh]);

  useRealtime("chat-unread", [{ table: "chat_messages" }], soon, refresh);

  useEffect(() => {
    soon();
    window.addEventListener(CHAT_READ_EVENT, soon);
    return () => {
      window.removeEventListener(CHAT_READ_EVENT, soon);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [soon]);

  return <ChatUnreadContext.Provider value={count}>{children}</ChatUnreadContext.Provider>;
}

export function useChatUnread() {
  return useContext(ChatUnreadContext);
}
