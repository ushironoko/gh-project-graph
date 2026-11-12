import { describe, expect, mock, test } from "bun:test";
import { createGraphqlHandler } from "../src/server/graphqlProxy.ts";

const okFetch = () =>
  mock(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }));

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost:5178/api/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:5178", origin: "http://localhost:5178", ...headers },
    body: JSON.stringify(body),
  });

describe("graphql proxy", () => {
  test("forwards an allow-listed operation with the server token", async () => {
    const fetchImpl = okFetch();
    const handle = createGraphqlHandler({ token: "tkn", fetch: fetchImpl });
    const res = await handle(post({ operation: "ProjectItems", variables: { owner: "acme", number: 1 } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { ok: true } });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.github.com/graphql");
    expect(new Headers(init?.headers).get("authorization")).toBe("bearer tkn");
    const sent = JSON.parse(String(init?.body));
    expect(sent.query).toContain("query ProjectItems");
    expect(sent.variables).toEqual({ owner: "acme", number: 1 });
  });

  test("rejects unknown operations and raw queries", async () => {
    const fetchImpl = okFetch();
    const handle = createGraphqlHandler({ token: "tkn", fetch: fetchImpl });
    expect((await handle(post({ operation: "DeleteRepo" }))).status).toBe(400);
    expect((await handle(post({ query: "mutation { x }" }))).status).toBe(400);
    expect((await handle(post({ operation: "toString" }))).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("rejects cross-origin and rebinding attempts", async () => {
    const handle = createGraphqlHandler({ token: "tkn", fetch: okFetch() });
    expect((await handle(post({ operation: "ProjectItems" }, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await handle(post({ operation: "ProjectItems" }, { host: "evil.example", origin: "http://evil.example" }))).status).toBe(403);
  });

  test("requires a JSON body", async () => {
    const handle = createGraphqlHandler({ token: "tkn", fetch: okFetch() });
    const res = await handle(post({ operation: "ProjectItems" }, { "content-type": "text/plain" }));
    expect(res.status).toBe(415);
  });

  test("reports a missing token", async () => {
    const handle = createGraphqlHandler({ token: null, fetch: okFetch() });
    const res = await handle(post({ operation: "ProjectItems" }));
    expect(res.status).toBe(500);
    expect((await res.json()).errors[0].message).toContain("GITHUB_TOKEN");
  });
});

import { createStaticHandler } from "../src/server/static.ts";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("static handler", () => {
  const root = mkdtempSync(join(tmpdir(), "pg-static-"));
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "index.html"), "<html>index</html>");
  writeFileSync(join(root, "assets", "app.js"), "console.log(1)");
  const handle = createStaticHandler(root);

  test("serves files", async () => {
    const res = await handle(new Request("http://localhost/assets/app.js"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("console.log(1)");
  });

  test("falls back to index.html", async () => {
    expect(await (await handle(new Request("http://localhost/"))).text()).toBe("<html>index</html>");
    expect(await (await handle(new Request("http://localhost/some/route"))).text()).toBe("<html>index</html>");
  });

  test("blocks path traversal", async () => {
    const res = await handle(new Request("http://localhost/..%2f..%2fetc%2fpasswd"));
    expect(await res.text()).toBe("<html>index</html>");
  });
});
