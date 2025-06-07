import { Tabs } from "nextra/components";
import { Tab } from "nextra/components/tabs/index.client";
import { FC, PropsWithChildren, ReactNode } from "react";

function TokenComponent() {
  return (props: PropsWithChildren) => props.children;
}
const TRPC = TokenComponent();
const ReactQuery = TokenComponent();
export const Codesplit = Object.assign(
  (props: PropsWithChildren) => {
    if (Array.isArray(props.children)) {
      const children = props.children;
      return (
        <Tabs items={["trpc", "react-query"]} storageKey="codesplit-flavor">
          <Tabs.Tab>{find(TRPC)}</Tabs.Tab>
          <Tabs.Tab>{find(ReactQuery)}</Tabs.Tab>
        </Tabs>
      );
      function find(token: FC<PropsWithChildren>): ReactNode {
        return children.find((x) => x.type === token) ?? null;
      }
    } else {
      return props.children;
    }
  },
  {
    TRPC,
    ReactQuery,
  }
);
