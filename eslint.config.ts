import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import type { ConfigArray } from "typescript-eslint";
// @ts-expect-error: no known types for @next/eslint-plugin-next
import next from "@next/eslint-plugin-next";
import { fixupConfigRules } from "@eslint/compat";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
export default tseslint.config(
  {
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      tseslint.configs.strictTypeChecked,
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowNumber: true,
        },
      ],
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-empty-function": "warn",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-unnecessary-type-parameters": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "warn",
      "no-empty": "warn",
      "@typescript-eslint/array-type": "warn",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "no-unused-private-class-members": "warn",
      "@typescript-eslint/no-extraneous-class": "warn",
    },
    languageOptions: {
      sourceType: "module",
      globals: {
        module: "writable",
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // fixupConfigRules(next.configs.recommended),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
  fixupConfigRules((next as any).configs["core-web-vitals"]),

  {
    ignores: [...[".pnpm-store", "pnpm-lock.yaml", "**/node_modules/*", "**/dist/*", "**/.*"]],
  }
) as ConfigArray;
