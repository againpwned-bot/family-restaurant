import { getSession } from "@/lib/auth/dal";
import { getDb } from "@/lib/server/db";
import { dropEndedSessions, subscribe, type RealtimeEvent, type Subscriber } from "@/lib/server/realtime";

const PING_MS = 25_000;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const db = await getDb();

  const encoder = new TextEncoder();
  let stop = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const write = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          stop();
        }
      };

      const subscriber: Subscriber = {
        userId: session.profile.id,
        sessionId: session.sessionId,
        send: (event: RealtimeEvent) => write(`data: ${JSON.stringify(event)}\n\n`),
        close: () => stop(),
      };
      const unsubscribe = subscribe(subscriber);
      const ping = setInterval(() => {
        write(": ping\n\n");
        void dropEndedSessions(db, [subscriber]).catch(() => {});
      }, PING_MS);

      stop = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
        }
      };
      request.signal.addEventListener("abort", () => stop());

      write("retry: 3000\nevent: ready\ndata: {}\n\n");
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
