"use client";

import { FC, PropsWithChildren, useCallback, useState } from "react";
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, ReactFlowProps } from "@xyflow/react";
import { Bleed } from "nextra/components";
import { produce } from "immer";
import { atom, createStore, Provider, useAtom, useAtomValue } from "jotai";
import { AddItem, DisplayItems, optimisticUpdateLogic } from "./FrontpageDemoComponents";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { optimisticEngineReactQuery } from "@optimistic-updates/react-query";
import { PrimitiveAtom } from "jotai/ts3.8/vanilla";

const store = createStore();
type Item = {
  id: number;
  label: string;
};
const settings = {
  optimisticUpdateEngine: atom(true),
  artificialServerDelay: atom(true),
};
const serverState = atom<Item[]>([
  { id: 0, label: "Bananas" },
  { id: 1, label: "Apples" },
  { id: 2, label: "Spinach" },
]);
const artificialServerDelayMS = atom((get) => (get(settings.artificialServerDelay) ? 1500 : 20));
export function optimisticUpdatesEnabled() {
  return store.get(settings.optimisticUpdateEngine);
}
function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function animate(anim: ReturnType<typeof edgeAnimation>, label: string, ms?: number) {
  const endScope = anim.scope(label);
  await wait(ms ?? store.get(artificialServerDelayMS));
  endScope();
}
export async function fetchServerState() {
  await animate(animationStates.queryToServer, "fetching");
  const value = store.get(serverState);
  await animate(animationStates.serverToQuery, value.map((x) => JSON.stringify(x)).join("\n"));
  return value;
}
export async function addToServerState(label: string) {
  await animate(animationStates.mutationToServer, `label = ${label}`);
  const value = store.get(serverState);
  const id = value.length;
  store.set(serverState, [...value, { id, label }]);
  await animate(animationStates.serverToMutation, `id = ${id}`);
  return id;
}
export function triggerMutationToQueryAnimation() {
  void animate(animationStates.mutationToQuery, "optimistic update", 500 /*ms*/);
}

function edgeAnimation() {
  let inc = 0;
  const data = atom({} as Record<number, string>);
  const labels = atom((get) => [...Object.values(get(data))]);
  const isActive = atom((get) => get(labels).length > 0);
  const label = atom((get) => get(labels).find((_) => true) ?? "");
  function scope(label: string) {
    const index = inc++;
    store.set(
      data,
      produce((v) => {
        v[index] = label;
      })
    );
    return () =>
      store.set(
        data,
        produce((v) => {
          delete v[index];
        })
      );
  }
  return { isActive, label, scope };
}

const animationStates = {
  mutationToServer: edgeAnimation(),
  serverToMutation: edgeAnimation(),
  queryToServer: edgeAnimation(),
  serverToQuery: edgeAnimation(),
  mutationToQuery: edgeAnimation(),
};

const queryClient = new QueryClient();
const { engine, makeUseEngineHook } = optimisticEngineReactQuery(queryClient);
export const useOptimisticQuery = makeUseEngineHook(useQuery);
optimisticUpdateLogic(engine);

export const FrontpageDemo: FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <Bleed full>
          <div
            style={{
              height: "calc(100vh - var(--nextra-navbar-height) - 11rem);)",
            }}
          >
            <Graph />
          </div>
        </Bleed>
      </Provider>
    </QueryClientProvider>
  );
};

function useAnimationValues(anim: ReturnType<typeof edgeAnimation>) {
  return { label: useAtomValue(anim.label), animated: useAtomValue(anim.isActive) };
}
const nodeTypes: ReactFlowProps["nodeTypes"] = {
  mutation: (props) => {
    return (
      <div className="react-flow__node-default" style={{ minWidth: "13rem" }}>
        <Handle type="target" position={Position.Top} style={{ left: "30%" }} />
        <Handle type="source" position={Position.Top} style={{ left: "70%" }} />
        <Handle type="source" position={Position.Left} id="optimistic" />
        <div>{props.data.label}</div>

        <div style={{ border: "2px solid", padding: ".25rem" }}>
          <AddItem />
        </div>
      </div>
    );
  },
  query: (props) => {
    return (
      <div className="react-flow__node-default" style={{ minWidth: "14rem" }}>
        <Handle type="target" position={Position.Top} style={{ left: "30%" }} />
        <Handle type="source" position={Position.Top} style={{ left: "70%" }} />
        <Handle type="target" position={Position.Right} id="optimistic" />
        <div>{props.data.label}</div>
        <div style={{ border: "2px solid", padding: ".25rem" }}>
          <DisplayItems />
        </div>
      </div>
    );
  },
  server: (props) => {
    return (
      <div className="react-flow__node-default">
        {props.data.label}
        <Handle type="source" position={Position.Bottom} style={{ left: "20%" }} id="queryOut" />
        <Handle type="target" position={Position.Bottom} style={{ left: "40%" }} id="queryIn" />
        <Handle type="source" position={Position.Bottom} style={{ left: "60%" }} id="mutationOut" />
        <Handle type="target" position={Position.Bottom} style={{ left: "80%" }} id="mutationIn" />
      </div>
    );
  },
  settings: (props) => {
    return (
      <div className="react-flow__node-default" style={{ minWidth: "16rem" }}>
        {props.data.label}

        <div style={{ border: "2px solid", padding: ".25rem", textAlign: "left" }}>
          <Checkbox checkbox={settings.artificialServerDelay}>Enable artificial server delay</Checkbox>
          <Checkbox checkbox={settings.optimisticUpdateEngine}>Enable optimistic update engine</Checkbox>
        </div>
      </div>
    );
  },
};

const Checkbox: FC<PropsWithChildren<{ checkbox: PrimitiveAtom<boolean> }>> = (props) => {
  const [value, setValue] = useAtom(props.checkbox);
  return (
    <div>
      <input type="checkbox" checked={value} onChange={() => setValue((x) => !x)} /> {props.children}
    </div>
  );
};

const Graph: FC = () => {
  return (
    <ReactFlow
      nodes={[
        {
          id: "q",
          type: "query",
          position: { x: -150, y: 100 },
          data: { label: "TODO list" },
        },
        {
          id: "m",
          position: { x: 150, y: 100 },
          type: "mutation",
          data: { label: "Add TODO" },
        },
        {
          id: "s",
          type: "server",
          position: { x: 0, y: -50 },
          data: { label: "Server" },
        },
        {
          id: "settings",
          type: "settings",
          position: { x: 150, y: 300 },
          data: { label: "Settings" },
        },
      ]}
      edges={[
        {
          id: "m->s",
          source: "m",
          target: "s",
          targetHandle: "mutationIn",
          ...useAnimationValues(animationStates.mutationToServer),
          markerEnd: { type: MarkerType.Arrow, strokeWidth: 2 },
        },
        {
          id: "s->m",
          source: "s",
          target: "m",
          sourceHandle: "mutationOut",
          ...useAnimationValues(animationStates.serverToMutation),
          markerEnd: { type: MarkerType.Arrow, strokeWidth: 2 },
        },
        {
          id: "q->s",
          source: "q",
          target: "s",
          ...useAnimationValues(animationStates.queryToServer),
          targetHandle: "queryIn",

          markerEnd: { type: MarkerType.Arrow, strokeWidth: 2 },
        },
        {
          id: "s->q",
          source: "s",
          target: "q",
          ...useAnimationValues(animationStates.serverToQuery),
          sourceHandle: "queryOut",
          markerEnd: { type: MarkerType.Arrow, strokeWidth: 2 },
        },
        {
          id: "m->q",
          source: "m",
          target: "q",
          sourceHandle: "optimistic",
          targetHandle: "optimistic",
          ...useAnimationValues(animationStates.mutationToQuery),
          markerEnd: { type: MarkerType.Arrow, strokeWidth: 2 },
        },
      ]}
      fitView
      nodeTypes={nodeTypes}
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
};
