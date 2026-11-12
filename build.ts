import vize from "@vizejs/unplugin/bun";

const result = await Bun.build({
  entrypoints: ["src/index.html"],
  outdir: "dist",
  minify: true,
  sourcemap: "linked",
  plugins: [vize()],
  define: {
    __VUE_OPTIONS_API__: "false",
    __VUE_PROD_DEVTOOLS__: "false",
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
  },
});

if (!result.success) throw new AggregateError(result.logs);
console.log(result.outputs.map((o) => `${o.path.replace(process.cwd() + "/", "")} ${o.size}`).join("\n"));
