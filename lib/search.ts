export function matches(query: string, ...fields: string[]) {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const q = norm(query.trim());
  return !q || fields.some((f) => norm(f).includes(q));
}
