import { useMDXComponents } from "nextra-theme-docs";
import { FC } from "react";

export const NpmInstall: FC<{ packageName: string }> = (props) => {
  const { code: Code, pre: Pre } = useMDXComponents();
  return (
    <>
      <Pre>
        <Code>
          <span>npm install --save {props.packageName}</span>
        </Code>
      </Pre>
      <div className="divider">OR</div>
      <Pre>
        <Code>
          <span>pnpm add {props.packageName}</span>
        </Code>
      </Pre>
      <div className="divider">OR</div>
      <Pre>
        <Code>
          <span>yarn add {props.packageName}</span>
        </Code>
      </Pre>
      <div className="divider">OR</div>
      <Pre>
        <Code>
          <span>bun add {props.packageName}</span>
        </Code>
      </Pre>
    </>
  );
};
