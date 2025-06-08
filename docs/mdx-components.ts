import { useMDXComponents as getThemeComponents } from "nextra-theme-docs"; // nextra-theme-blog or your custom theme
import * as customComponents from "./custom";
import { Tabs, Callout } from "nextra/components";

// Get the default MDX components
const themeComponents = getThemeComponents();

// Merge components
export function useMDXComponents(components?: any) {
  console.log({ themeComponents, components });
  return {
    ...customComponents,
    ...themeComponents,
    ...components,
    ...{
      Tabs,
      Callout,
    },
  };
}
