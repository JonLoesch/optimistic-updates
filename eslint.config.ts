import eslint from "@eslint/js";
import tseslint, { type ConfigArray } from "typescript-eslint";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
export default tseslint.config({
  extends: [
    eslint.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    tseslint.configs.strictTypeChecked
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/no-empty-function": "warn",
    "@typescript-eslint/no-confusing-void-expression": "off",
    "@typescript-eslint/no-unnecessary-type-parameters": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "prefer-const": "warn",
    "no-empty": "warn",
    "@typescript-eslint/array-type": "warn",
    "@typescript-eslint/consistent-type-definitions": "warn",
    "@typescript-eslint/no-empty-object-type": "warn"
  },
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
    "node_modules/*",
    "dist/*",
    "packages/**/node_modules/*",
    "packages/**/dist/*",
    "**/.*"
  ]
}) as ConfigArray;
