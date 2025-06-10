"use client";

import { FC, useEffect, useState } from "react";

export function useColorMode() {
  const [state, setState] = useState<"dark" | "light" | undefined>();
  useEffect(() => {
    const html = document.getElementsByTagName("html")[0];
    const observer = new MutationObserver((mutationList) => {
      for (const event of mutationList) {
        if (event.type === "attributes" && event.attributeName === "class") {
          if (html.classList.contains("dark")) {
            setState("dark");
          } else if (html.classList.contains("light")) {
            setState("light");
          }
        }
      }
    });
    observer.observe(html, { attributes: true });
    return () => observer.disconnect();
  }, []);
  return state;
}
export const DaisyUiPatchTheme: FC = () => {
  const mode = useColorMode();
  useEffect(() => {
    const html = document.getElementsByTagName("html")[0];
    if (mode === "dark") {
      html.dataset.theme = "night"; // https://daisyui.com/docs/themes/
    } else if (mode === "light") {
      html.dataset.theme = "corporate"; // https://daisyui.com/docs/themes/
    }
  }, [mode]);
  return null;
};
