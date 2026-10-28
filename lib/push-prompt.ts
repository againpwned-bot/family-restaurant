import "server-only";

import { cookies } from "next/headers";

export async function shouldShowPushPrompt() {
  return (await cookies()).get("push-prompt")?.value !== "hidden";
}
