import { useMDXComponents } from "nextra-theme-docs";
import { FC } from "react";

export const NpmInstall: FC<{ packageName: string }> = (props) => {
  const { code } = useMDXComponents();
  return (
    <>
      <code> npm install --save {props.packageName} </code>
      <br />
      --- or ---
      <br />
      <code>pnpm add {props.packageName}</code>
    </>
  );
};

// TODO use something like: https://tanstack.com/query/latest/docs/framework/react/installation
