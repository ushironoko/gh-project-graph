export const resolveToken = (env: Record<string, string | undefined>): string | null => {
  const fromEnv = env.GITHUB_TOKEN ?? env.GH_TOKEN;
  if (fromEnv) return fromEnv;
  try {
    const out = Bun.spawnSync(["gh", "auth", "token"], { stderr: "ignore" });
    const token = out.success ? out.stdout.toString().trim() : "";
    return token || null;
  } catch {
    return null;
  }
};
