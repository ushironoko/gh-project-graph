import { isOperationName, operations } from "../shared/queries.ts";

export type ProxyDeps = {
  token: string | null;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  endpoint?: string;
};

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const fail = (status: number, message: string) => json(status, { errors: [{ message }] });

const hostname = (host: string) =>
  host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : (host.split(":")[0] ?? "");

const isTrustedRequest = (req: Request): boolean => {
  const host = req.headers.get("host") ?? "";
  if (!localHosts.has(hostname(host))) return false;
  const origin = req.headers.get("origin");
  return origin === null || origin === `http://${host}`;
};

const readBody = async (
  req: Request,
): Promise<{ operation?: unknown; variables?: unknown } | null> => {
  try {
    const body: unknown = await req.json();
    return typeof body === "object" && body !== null ? body : null;
  } catch {
    return null;
  }
};

export const createGraphqlHandler =
  (deps: ProxyDeps) =>
  async (req: Request): Promise<Response> => {
    if (!isTrustedRequest(req)) return fail(403, "Forbidden origin");
    if (!(req.headers.get("content-type") ?? "").startsWith("application/json"))
      return fail(415, "Expected JSON");
    const body = await readBody(req);
    if (!body || !isOperationName(body.operation)) return fail(400, "Unknown operation");
    if (!deps.token) return fail(500, "No GitHub token. Set GITHUB_TOKEN or run `gh auth login`.");
    const upstream = await deps.fetch(deps.endpoint ?? "https://api.github.com/graphql", {
      method: "POST",
      headers: {
        authorization: `bearer ${deps.token}`,
        "content-type": "application/json",
        "user-agent": "gh-project-graph",
      },
      body: JSON.stringify({ query: operations[body.operation], variables: body.variables ?? {} }),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  };
