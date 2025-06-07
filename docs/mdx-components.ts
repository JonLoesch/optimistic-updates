import { useMDXComponents as getThemeComponents } from "nextra-theme-docs"; // nextra-theme-blog or your custom theme
import * as customComponents from "./custom";

// Get the default MDX components
const themeComponents = getThemeComponents();

// Merge components
export function useMDXComponents(components?: any) {
  return {
    ...customComponents,
    ...themeComponents,
    ...components,
  };
}
