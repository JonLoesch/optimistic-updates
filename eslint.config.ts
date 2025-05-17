import eslint from "@eslint/js";
import tseslint, { type ConfigArray } from "typescript-eslint";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
export default tseslint.config({
  extends: [
    eslint.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    tseslint.configs.strictTypeChecked
  ],
  languageOptions: {
    // sourceType: 'module',
    globals: {
      module: "writable"
    },
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname
    }
  },
  files: ["**/*.ts", "**/*.js"],

  ignores: [
    ".pnpm-store",
    "pnpm-lock.yaml",
    "node_modules",
    "dist",
    "packages/**/node_modules/*",
    "packages/**/dist/*",
    "**/.*"
  ]
}) as ConfigArray;
