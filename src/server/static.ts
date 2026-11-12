import { resolve, sep } from "node:path";

const safeDecode = (path: string): string | null => {
  try {
    return decodeURIComponent(path);
  } catch {
    return null;
  }
};

export const createStaticHandler = (rootDir: string) => {
  const root = resolve(rootDir);
  const index = Bun.file(resolve(root, "index.html"));
  return async (req: Request): Promise<Response> => {
    const path = safeDecode(new URL(req.url).pathname);
    const target = path === null ? null : resolve(root, `.${path}`);
    const inside = target !== null && target.startsWith(root + sep);
    const file = inside ? Bun.file(target) : null;
    if (file && (await file.exists())) return new Response(file);
    return new Response(index, { headers: { "content-type": "text/html; charset=utf-8" } });
  };
};
