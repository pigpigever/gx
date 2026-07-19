import { defineConfig } from "tsup";
import path from "path";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  dts: false,
  splitting: false,
  sourcemap: true,
  minify: false,
  target: "node18",
  shims: true,
  esbuildPlugins: [
    {
      name: "alias",
      setup(build) {
        build.onResolve({ filter: /^@\// }, (args) => {
          // Map .js import specifier to the actual .ts source file
          return { path: path.resolve("./src", args.path.slice(2).replace(/\.js$/, ".ts")) };
        });
      },
    },
  ],
});
