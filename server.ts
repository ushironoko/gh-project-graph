import { createGraphqlHandler } from "./src/server/graphqlProxy.ts";
import { createStaticHandler } from "./src/server/static.ts";
import { resolveToken } from "./src/server/token.ts";

const token = resolveToken(process.env);
const graphql = createGraphqlHandler({ token, fetch: (url, init) => fetch(url, init) });
const files = createStaticHandler(new URL("./dist", import.meta.url).pathname);

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT ?? 5178),
  routes: {
    "/api/graphql": { POST: graphql },
  },
  fetch: files,
});

console.log(`gh-project-graph: ${server.url}${token ? "" : "  (warning: no GitHub token found)"}`);
