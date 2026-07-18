import { defineConfig } from "tsup";

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
});
