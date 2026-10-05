import esbuild from "esbuild";

const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ["src/index.ts"],
  outfile: "dist/server.js",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  // Bundle every dependency into a single file so the runtime image
  // does not need `npm install` (no node_modules on the server).
  packages: "bundle",
  minify: true,
  sourcemap: false,
  legalComments: "none",
  banner: {
    js: "// node-shell-api - single-file bundle. Run with: node server.js",
  },
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("esbuild watching...");
} else {
  await esbuild.build(options);
  console.log("Built dist/server.js");
}
