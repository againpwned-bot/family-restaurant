let open: string | null = null;

// The conversation currently on screen, so its messages don't also pop up as banners.
export function setOpenConversation(conversation: string | null) {
  open = conversation;
}

export function openConversation() {
  return open;
}
