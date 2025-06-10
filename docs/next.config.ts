import type { NextConfig } from "next";
import nextra, { NextraConfig } from "nextra";
import { env } from "process";

const nextConfig: NextConfig = {
  /**
   * Enable static exports.
   *
   * @see https://nextjs.org/docs/app/building-your-application/deploying/static-exports
   */
  output: "export",

  /**
   * Set base path. This is the slug of your GitHub repository.
   *
   * @see https://nextjs.org/docs/app/api-reference/next-config-js/basePath
   */
  basePath: env.PAGES_BASE_PATH,

  /**
   * Disable server-based image optimization. Next.js does not support
   * dynamic features with static exports.
   *
   * @see https://nextjs.org/docs/app/api-reference/components/image#unoptimized
   */
  images: {
    unoptimized: true,
  },

  reactStrictMode: true,
  pageExtensions: ["tsx", "mdx"],
  turbopack: {
    resolveAlias: {
      // Path to your `mdx-components` file with extension
      "next-mdx-import-source-file": "./src/mdx-components.ts",
    },
  },
};

const nextraConfig: NextraConfig = {};

export default nextra(nextraConfig)(nextConfig);
