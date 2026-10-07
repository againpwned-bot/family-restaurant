import "server-only";

import { cookies } from "next/headers";

/** Server side: show the "turn on notifications" card unless this browser opted out. */
export async function shouldShowPushPrompt() {
  return (await cookies()).get("push-prompt")?.value !== "hidden";
}
