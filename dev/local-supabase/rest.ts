// PostgREST subset for the emulator. Covers what supabase-js sends from this app:
// select (with columns, aliases and embedded relations), filters (eq, neq, gt,
// gte, lt, lte, like, ilike, is, in, not., or=()), order (incl. embedded), limit,
// offset, count=exact, single/maybeSingle, insert/upsert, update, delete, rpc.
// Every statement runs as the caller's role with their JWT claims, so RLS and
// column grants apply exactly as written in the migrations.

import type { PGlite } from "@electric-sql/pglite";

import { asRole, primaryKey, type Tx } from "./db";
import { claimsFromHeaders } from "./jwt";
import { empty, json, pgError, readJson } from "./http";

type Fk = { name: string; table: string; cols: string[]; refTable: string; refCols: string[] };
type Fn = { args: { name: string; type: string }[]; retset: boolean; kind: "composite" | "void" | "scalar" };
type SelectNode =
  | { kind: "star" }
  | { kind: "col"; name: string; alias?: string }
  | { kind: "rel"; name: string; alias?: string; hint?: string; inner: boolean; children: SelectNode[] };

class RestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const ident = (name: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new RestError(400, "PGRST100", `invalid identifier: ${name}`);
  return `"${name}"`;
};

export async function createRest(db: PGlite) {
  // Schema cache, like PostgREST's.
  const columns = new Map<string, Map<string, string>>();
  const colRes = await db.query<{ table_name: string; column_name: string; type: string }>(`
    select c.relname as table_name, a.attname as column_name, format_type(a.atttypid, a.atttypmod) as type
      from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'v') and a.attnum > 0 and not a.attisdropped`);
  for (const r of colRes.rows) {
    if (!columns.has(r.table_name)) columns.set(r.table_name, new Map());
    columns.get(r.table_name)!.set(r.column_name, r.type);
  }

  const fkRes = await db.query<Fk>(`
    select con.conname as name, rel.relname as table, ref.relname as "refTable",
           array(select attname from pg_attribute where attrelid = con.conrelid and attnum = any(con.conkey)) as cols,
           array(select attname from pg_attribute where attrelid = con.confrelid and attnum = any(con.confkey)) as "refCols"
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid join pg_namespace n on n.oid = rel.relnamespace
      join pg_class ref on ref.oid = con.confrelid
     where con.contype = 'f' and n.nspname = 'public'`);
  const fks = fkRes.rows;

  const fns = new Map<string, Fn>();
  const fnRes = await db.query<{
    proname: string;
    proretset: boolean;
    typtype: string;
    rettype: string;
    argnames: string[];
    argtypes: string[];
  }>(`
    select p.proname, p.proretset, t.typtype, format_type(p.prorettype, null) as rettype,
           coalesce(p.proargnames, '{}'::text[]) as argnames,
           array(select format_type(x, null) from unnest(p.proargtypes::oid[]) with ordinality as u(x, i) order by i) as argtypes
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type t on t.oid = p.prorettype
     where n.nspname = 'public'`);
  for (const f of fnRes.rows) {
    fns.set(f.proname, {
      args: f.argtypes.map((type, i) => ({ name: f.argnames[i], type })),
      retset: f.proretset,
      kind: f.rettype === "void" ? "void" : f.typtype === "c" ? "composite" : "scalar",
    });
  }

  const colType = (table: string, col: string) => {
    const type = columns.get(table)?.get(col);
    if (!type) throw new RestError(400, "42703", `column ${table}.${col} does not exist`);
    return type;
  };

  // --- select parsing -------------------------------------------------------

  function splitTop(input: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let current = "";
    let quoted = false;
    for (const ch of input) {
      if (ch === '"') quoted = !quoted;
      if (!quoted && ch === "(") depth++;
      if (!quoted && ch === ")") depth--;
      if (!quoted && ch === "," && depth === 0) {
        out.push(current);
        current = "";
      } else current += ch;
    }
    if (current) out.push(current);
    return out.map((s) => s.trim()).filter(Boolean);
  }

  function parseSelect(input: string): SelectNode[] {
    return splitTop(input || "*").map((item): SelectNode => {
      if (item === "*") return { kind: "star" };
      const rel = item.match(/^(?:([A-Za-z_]\w*):)?([A-Za-z_]\w*)(?:!([A-Za-z_]\w*))?(!inner)?\(([\s\S]*)\)$/);
      if (rel) {
        const [, alias, name, hint, inner, inside] = rel;
        return {
          kind: "rel",
          name,
          alias,
          hint: hint === "inner" ? undefined : hint,
          inner: !!inner || hint === "inner",
          children: parseSelect(inside),
        };
      }
      const col = item.match(/^(?:([A-Za-z_]\w*):)?([A-Za-z_]\w*)(?:::\w+)?$/);
      if (col) return { kind: "col", alias: col[1], name: col[2] };
      throw new RestError(400, "PGRST100", `unsupported select item: ${item}`);
    });
  }

  function resolveFk(parent: string, rel: string, hint?: string) {
    let candidates = fks.filter(
      (fk) => (fk.table === parent && fk.refTable === rel) || (fk.table === rel && fk.refTable === parent),
    );
    if (hint) candidates = candidates.filter((fk) => fk.name === hint || fk.cols.includes(hint));
    if (candidates.length === 0) throw new RestError(400, "PGRST200", `no relationship between ${parent} and ${rel}`);
    if (candidates.length > 1)
      throw new RestError(300, "PGRST201", `more than one relationship between ${parent} and ${rel}`);
    const fk = candidates[0];
    return { fk, toOne: fk.table === parent };
  }

  type Ctx = { params: unknown[]; n: number; embedOrder: Map<string, string>; embedFilters: Map<string, string[][]> };
  const param = (ctx: Ctx, value: unknown) => {
    ctx.params.push(value);
    return `$${ctx.params.length}`;
  };

  function projection(table: string, alias: string, nodes: SelectNode[], ctx: Ctx, path: string): string {
    const parts: string[] = [];
    if (nodes.some((n) => n.kind === "star")) parts.push(`to_jsonb(${alias})`);
    const pairs: string[] = [];
    for (const node of nodes) {
      if (node.kind === "col") {
        colType(table, node.name);
        pairs.push(`'${node.alias ?? node.name}', ${alias}.${ident(node.name)}`);
      } else if (node.kind === "rel") {
        if (!columns.has(node.name)) throw new RestError(400, "PGRST200", `unknown relation ${node.name}`);
        const { fk, toOne } = resolveFk(table, node.name, node.hint);
        const sub = `t${++ctx.n}`;
        const key = node.alias ?? node.name;
        const subPath = path ? `${path}.${key}` : key;
        const join = toOne
          ? fk.cols.map((c, i) => `${sub}.${ident(fk.refCols[i])} = ${alias}.${ident(c)}`).join(" and ")
          : fk.cols.map((c, i) => `${sub}.${ident(c)} = ${alias}.${ident(fk.refCols[i])}`).join(" and ");
        const filters = (ctx.embedFilters.get(subPath) ?? []).map(([col, expr]) =>
          filterSql(node.name, sub, col, expr, ctx),
        );
        const where = [join, ...filters].join(" and ");
        const proj = projection(node.name, sub, node.children, ctx, subPath);
        const expr = toOne
          ? `(select ${proj} from public.${ident(node.name)} ${sub} where ${where} limit 1)`
          : `(select coalesce(jsonb_agg(${proj}${orderSql(node.name, sub, ctx.embedOrder.get(subPath))}), '[]'::jsonb) from public.${ident(node.name)} ${sub} where ${where})`;
        pairs.push(`'${key}', ${expr}`);
      }
    }
    for (let i = 0; i < pairs.length; i += 40) parts.push(`jsonb_build_object(${pairs.slice(i, i + 40).join(", ")})`);
    return parts.length ? parts.join(" || ") : "'{}'::jsonb";
  }

  function orderSql(table: string, alias: string, spec: string | undefined) {
    if (!spec) return "";
    const items = spec.split(",").map((part) => {
      const [col, dir, nulls] = part.split(".");
      colType(table, col);
      const d = dir === "desc" ? "desc" : "asc";
      const nl = nulls === "nullsfirst" ? " nulls first" : nulls === "nullslast" ? " nulls last" : "";
      return `${alias}.${ident(col)} ${d}${nl}`;
    });
    return ` order by ${items.join(", ")}`;
  }

  function pgArrayLiteral(values: string[]) {
    return `{${values.map((v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;
  }

  function parseInList(value: string): string[] {
    const inside = value.replace(/^\(/, "").replace(/\)$/, "");
    return splitTop(inside).map((v) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v));
  }

  function filterSql(table: string, alias: string, col: string, expr: string, ctx: Ctx): string {
    let negate = false;
    let rest = expr;
    if (rest.startsWith("not.")) {
      negate = true;
      rest = rest.slice(4);
    }
    const dot = rest.indexOf(".");
    const op = rest.slice(0, dot);
    const value = rest.slice(dot + 1);
    const type = colType(table, col);
    const c = `${alias}.${ident(col)}`;
    const ops: Record<string, string> = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" };
    let sql: string;
    if (op in ops) sql = `${c} ${ops[op]} ${param(ctx, value)}::${type}`;
    else if (op === "like" || op === "ilike") sql = `${c}::text ${op} ${param(ctx, value.replace(/\*/g, "%"))}`;
    else if (op === "is") {
      const v = value.toLowerCase();
      if (!["null", "true", "false", "unknown"].includes(v))
        throw new RestError(400, "PGRST100", `bad is value ${value}`);
      sql = `${c} is ${v}`;
    } else if (op === "in") sql = `${c} = any(${param(ctx, pgArrayLiteral(parseInList(value)))}::${type}[])`;
    else throw new RestError(400, "PGRST100", `unsupported operator ${op}`);
    return negate ? `not (${sql})` : sql;
  }

  function logicSql(table: string, alias: string, op: "or" | "and", value: string, ctx: Ctx): string {
    const inside = value.replace(/^\(/, "").replace(/\)$/, "");
    const parts = splitTop(inside).map((cond) => {
      const nested = cond.match(/^(not\.)?(or|and)(\(.*\))$/);
      if (nested) {
        const sql = logicSql(table, alias, nested[2] as "or" | "and", nested[3], ctx);
        return nested[1] ? `not (${sql})` : sql;
      }
      const first = cond.indexOf(".");
      return filterSql(table, alias, cond.slice(0, first), cond.slice(first + 1), ctx);
    });
    return `(${parts.join(op === "or" ? " or " : " and ")})`;
  }

  function buildWhere(table: string, search: URLSearchParams, ctx: Ctx, alias = "t0"): string {
    const reserved = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
    const conds: string[] = [];
    for (const [key, value] of search) {
      if (reserved.has(key)) continue;
      if (key === "or" || key === "and") {
        conds.push(logicSql(table, alias, key, value, ctx));
        continue;
      }
      if (key.includes(".")) {
        const parts = key.split(".");
        const last = parts.pop()!;
        const path = parts.join(".");
        if (last === "order") ctx.embedOrder.set(path, value);
        else if (last !== "limit" && last !== "offset") {
          if (!ctx.embedFilters.has(path)) ctx.embedFilters.set(path, []);
          ctx.embedFilters.get(path)!.push([last, value]);
        }
        continue;
      }
      conds.push(filterSql(table, alias, key, value, ctx));
    }
    return conds.length ? ` where ${conds.join(" and ")}` : "";
  }

  // --- request handling ------------------------------------------------------

  async function runRead(tx: Tx, table: string, url: URL, wantCount: boolean) {
    const ctx: Ctx = { params: [], n: 0, embedOrder: new Map(), embedFilters: new Map() };
    const where = buildWhere(table, url.searchParams, ctx);
    const nodes = parseSelect(url.searchParams.get("select") ?? "*");
    const proj = projection(table, "t0", nodes, ctx, "");
    const order = orderSql(table, "t0", url.searchParams.get("order") ?? undefined);
    const limit = url.searchParams.get("limit");
    const offset = url.searchParams.get("offset");
    const sql =
      `select ${proj} as j from public.${ident(table)} t0${where}${order}` +
      (limit ? ` limit ${Number(limit)}` : "") +
      (offset ? ` offset ${Number(offset)}` : "");
    const rows = (await tx.query<{ j: unknown }>(sql, ctx.params)).rows.map((r) => r.j);
    let total: number | null = null;
    if (wantCount) {
      const countCtx: Ctx = { params: [], n: 0, embedOrder: new Map(), embedFilters: new Map() };
      const countWhere = buildWhere(table, url.searchParams, countCtx);
      total = (
        await tx.query<{ n: number }>(
          `select count(*)::int as n from public.${ident(table)} t0${countWhere}`,
          countCtx.params,
        )
      ).rows[0].n;
    }
    return { rows, total };
  }

  async function runWrite(tx: Tx, table: string, method: string, url: URL, body: unknown, prefer: string) {
    const ctx: Ctx = { params: [], n: 0, embedOrder: new Map(), embedFilters: new Map() };
    let write: string;
    if (method === "POST") {
      const rows = (Array.isArray(body) ? body : [body]) as Record<string, unknown>[];
      const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      keys.forEach((k) => colType(table, k));
      const cols = keys.map(ident).join(", ");
      const source = `select ${cols} from jsonb_populate_recordset(null::public.${ident(table)}, ${param(ctx, JSON.stringify(rows))}::jsonb)`;
      let conflict = "";
      if (prefer.includes("resolution=")) {
        const target = (url.searchParams.get("on_conflict") ?? "").split(",").filter(Boolean);
        const conflictCols = target.length ? target : await primaryKey(tx, "public", table);
        const updates = keys.filter((k) => !conflictCols.includes(k));
        conflict =
          prefer.includes("ignore-duplicates") || updates.length === 0
            ? ` on conflict (${conflictCols.map(ident).join(", ")}) do nothing`
            : ` on conflict (${conflictCols.map(ident).join(", ")}) do update set ${updates.map((k) => `${ident(k)} = excluded.${ident(k)}`).join(", ")}`;
      }
      write = `insert into public.${ident(table)} as t0 (${cols}) ${source}${conflict} returning t0.*`;
    } else if (method === "PATCH") {
      const values = body as Record<string, unknown>;
      const keys = Object.keys(values);
      if (!keys.length) throw new RestError(400, "PGRST100", "empty update");
      keys.forEach((k) => colType(table, k));
      const rec = param(ctx, JSON.stringify(values));
      const where = buildWhere(table, url.searchParams, ctx);
      write = `update public.${ident(table)} t0 set ${keys.map((k) => `${ident(k)} = (jsonb_populate_record(null::public.${ident(table)}, ${rec}::jsonb)).${ident(k)}`).join(", ")}${where} returning t0.*`;
    } else {
      const where = buildWhere(table, url.searchParams, ctx);
      write = `delete from public.${ident(table)} t0${where} returning t0.*`;
    }
    const nodes = parseSelect(url.searchParams.get("select") ?? "*");
    const proj = projection(table, "t0", nodes, ctx, "");
    const sql = `with w as (${write}) select ${proj} as j from w t0`;
    return (await tx.query<{ j: unknown }>(sql, ctx.params)).rows.map((r) => r.j);
  }

  async function runRpc(tx: Tx, name: string, args: Record<string, unknown>) {
    const fn = fns.get(name);
    if (!fn) throw new RestError(404, "PGRST202", `function public.${name} not found`);
    const ctx: Ctx = { params: [], n: 0, embedOrder: new Map(), embedFilters: new Map() };
    const named = Object.entries(args).map(([key, value]) => {
      const arg = fn.args.find((a) => a.name === key);
      if (!arg) throw new RestError(404, "PGRST202", `function public.${name} has no argument ${key}`);
      const v =
        value === null || value === undefined
          ? null
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
      return `${ident(key)} => ${param(ctx, v)}::${arg.type}`;
    });
    const call = `public.${ident(name)}(${named.join(", ")})`;
    if (fn.kind === "void") {
      await tx.query(`select ${call}`, ctx.params);
      return { value: null, set: false, void: true };
    }
    if (fn.kind === "composite") {
      const rows = (await tx.query<{ j: unknown }>(`select to_jsonb(r) as j from ${call} r`, ctx.params)).rows.map(
        (r) => r.j,
      );
      return { value: fn.retset ? rows : (rows[0] ?? null), set: fn.retset, void: false };
    }
    const rows = (
      await tx.query<{ j: unknown }>(
        fn.retset ? `select to_jsonb(r) as j from ${call} r` : `select to_jsonb(${call}) as j`,
        ctx.params,
      )
    ).rows.map((r) => r.j);
    return { value: fn.retset ? rows : rows[0], set: fn.retset, void: false };
  }

  return async function handle(request: Request, pathname: string): Promise<Response> {
    const url = new URL(request.url);
    const claims = claimsFromHeaders(request.headers);
    const prefer = request.headers.get("prefer") ?? "";
    const wantsObject = (request.headers.get("accept") ?? "").includes("vnd.pgrst.object");
    const route = pathname.replace(/^\/rest\/v1\/?/, "");

    try {
      if (route.startsWith("rpc/")) {
        const name = route.slice(4);
        const args = request.method === "GET" ? Object.fromEntries(url.searchParams) : await readJson(request);
        const result = await asRole(db, claims, (tx) => runRpc(tx, name, args));
        if (result.void) return empty(204);
        return json(200, result.value);
      }

      const table = route;
      if (!columns.has(table)) throw new RestError(404, "PGRST205", `relation public.${table} does not exist`);

      if (request.method === "GET" || request.method === "HEAD") {
        const { rows, total } = await asRole(db, claims, (tx) => runRead(tx, table, url, prefer.includes("count=")));
        const headers: Record<string, string> = {};
        if (total !== null) headers["content-range"] = rows.length ? `0-${rows.length - 1}/${total}` : `*/${total}`;
        if (request.method === "HEAD") return empty(200, headers);
        if (wantsObject) {
          if (rows.length !== 1) {
            return json(406, {
              code: "PGRST116",
              message: "JSON object requested, multiple (or no) rows returned",
              details: `The result contains ${rows.length} rows`,
              hint: null,
            });
          }
          return json(200, rows[0], headers);
        }
        return json(200, rows, headers);
      }

      if (["POST", "PATCH", "DELETE"].includes(request.method)) {
        const body = request.method === "DELETE" ? null : await readJson<unknown>(request);
        const rows = await asRole(db, claims, (tx) => runWrite(tx, table, request.method, url, body, prefer));
        const status = request.method === "POST" ? 201 : 200;
        if (!prefer.includes("return=representation")) return empty(request.method === "POST" ? 201 : 204);
        if (wantsObject) {
          if (rows.length !== 1)
            return json(406, {
              code: "PGRST116",
              message: "JSON object requested, multiple (or no) rows returned",
              details: null,
              hint: null,
            });
          return json(status, rows[0]);
        }
        return json(status, rows);
      }
      return json(405, { code: "PGRST117", message: `unsupported method ${request.method}` });
    } catch (error) {
      if (error instanceof RestError)
        return json(error.status, { code: error.code, message: error.message, details: null, hint: null });
      return pgError(error);
    }
  };
}
