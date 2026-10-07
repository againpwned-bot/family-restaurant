// Small helpers shared by the emulator's HTTP handlers.

export function json(status: number, data: unknown, headers: Record<string, string> = {}): Response {
  return new Response(data === undefined ? null : JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export function empty(status = 204, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  const text = await request.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

/** Postgres error -> PostgREST-style error body + HTTP status. */
export function pgError(error: unknown): Response {
  const e = error as { code?: string; message?: string; detail?: string; hint?: string };
  const code = e.code ?? "XX000";
  const status =
    code === "42501"
      ? 403
      : code === "23505" || code === "23503"
        ? 409
        : code === "P0002"
          ? 404
          : code.startsWith("22") || code.startsWith("23") || code === "P0001" || code === "42703" || code === "42883"
            ? 400
            : code === "PGRST116"
              ? 406
              : 500;
  return json(status, { code, message: e.message ?? "error", details: e.detail ?? null, hint: e.hint ?? null });
}
