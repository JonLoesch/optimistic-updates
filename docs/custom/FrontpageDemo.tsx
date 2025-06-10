"use client";

import { FC, PropsWithChildren, useCallback, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  NodeProps,
  Position,
  ReactFlow,
  ReactFlowProps,
} from "@xyflow/react";
import { Bleed } from "nextra/components";
import { produce } from "immer";
import { atom, createStore, Provider, useAtom, useAtomValue, PrimitiveAtom } from "jotai";
import { AddItem, DisplayItems, optimisticUpdateLogic } from "./FrontpageDemoComponents";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { optimisticEngineReactQuery } from "@optimistic-updates/react-query";
import { useColorMode } from "./DaisyUiPatchTheme";

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
  { id: 0, label: "Write amazing code" },
  { id: 1, label: "???" },
  { id: 2, label: "Profit!" },
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
          <div className="card w-full">
            <div className="bg-base-100 card-body">
              <div className="card-title self-center">Live Demo</div>
              <div className="aspect-[3/2]">
                <Graph />
              </div>
            </div>
          </div>
        </Bleed>
      </Provider>
    </QueryClientProvider>
  );
};

function useAnimationValue(anim: ReturnType<typeof edgeAnimation>) {
  return { label: useAtomValue(anim.label), animated: useAtomValue(anim.isActive) };
}
function useAnimationValues<T extends string>(anims: Record<T, ReturnType<typeof edgeAnimation>>) {
  return Object.fromEntries(
    Object.entries<ReturnType<typeof edgeAnimation>>(anims).map(([k, v]) => [k, useAnimationValue(v)])
  ) as Record<T, ReturnType<typeof useAnimationValue>>;
}
const ReactFlowNode: FC<PropsWithChildren<{ component?: FC; data: { label: string }; className?: string }>> = (
  props
) => {
  return (
    <div className={`card bg-base-200 w-full ${props.className}`}>
      {props.children}
      <div className="card-body">
        <div className="card-title self-center">{props.data.label}</div>

        {props.component && <props.component />}
      </div>
    </div>
  );
};

const nodeTypes: ReactFlowProps["nodeTypes"] = {
  mutation: (props) => (
    <ReactFlowNode {...props} component={AddItem}>
      <Handle type="target" position={Position.Top} className="left-[30%]" />
      <Handle type="source" position={Position.Top} className="left-[70%]" />
      <Handle type="source" position={Position.Left} id="optimistic" />
    </ReactFlowNode>
  ),
  query: (props) => {
    return (
      <ReactFlowNode {...props} component={DisplayItems}>
        <Handle type="target" position={Position.Top} className="left-[30%]" />
        <Handle type="source" position={Position.Top} className="left-[70%]" />
        <Handle type="target" position={Position.Right} id="optimistic" />
      </ReactFlowNode>
    );
  },
  server: (props) => {
    return (
      <ReactFlowNode {...props}>
        <Handle type="source" position={Position.Bottom} className="left-[20%]" id="queryOut" />
        <Handle type="target" position={Position.Bottom} className="left-[40%]" id="queryIn" />
        <Handle type="source" position={Position.Bottom} className="left-[60%]" id="mutationOut" />
        <Handle type="target" position={Position.Bottom} className="left-[80%]" id="mutationIn" />
      </ReactFlowNode>
    );
  },
  settings: (props) => {
    return (
      <ReactFlowNode
        {...props}
        className="card-xs"
        component={() => (
          <div className="">
            <Checkbox checkbox={settings.artificialServerDelay}>Enable artificial server delay</Checkbox>
            <Checkbox checkbox={settings.optimisticUpdateEngine}>Enable optimistic update engine</Checkbox>
          </div>
        )}
      />
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
  const anim = useAnimationValues<keyof typeof animationStates>(animationStates);
  const colorMode = useColorMode();
  return (
    <ReactFlow
      nodes={[
        {
          id: "q",
          type: "query",
          position: { x: -200, y: 100 },
          width: 250,
          data: { label: "TODO list" },
        },
        {
          id: "m",
          type: "mutation",
          position: { x: 150, y: 100 },
          width: 250,
          data: { label: "Add TODO" },
        },
        {
          id: "s",
          type: "server",
          position: { x: 0, y: -50 },
          width: 200,
          data: { label: "Server" },
        },
        {
          id: "settings",
          type: "settings",
          width: 250,
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
          ...anim.mutationToServer,
          markerEnd: { type: MarkerType.Arrow, strokeWidth: 2 },
        },
        {
          id: "s->m",
          source: "s",
          target: "m",
          sourceHandle: "mutationOut",
          ...anim.serverToMutation,
          markerEnd: { type: MarkerType.Arrow, strokeWidth: 2 },
        },
        {
          id: "q->s",
          source: "q",
          target: "s",
          ...anim.queryToServer,
          targetHandle: "queryIn",

          markerEnd: { type: MarkerType.Arrow, strokeWidth: 2 },
        },
        {
          id: "s->q",
          source: "s",
          target: "q",
          ...anim.serverToQuery,
          sourceHandle: "queryOut",
          markerEnd: { type: MarkerType.Arrow, strokeWidth: 2 },
        },
        ...(useAtomValue(settings.optimisticUpdateEngine)
          ? [
              {
                id: "m->q",
                source: "m",
                target: "q",
                sourceHandle: "optimistic",
                targetHandle: "optimistic",
                ...anim.mutationToQuery,
                markerEnd: { type: MarkerType.Arrow, strokeWidth: 2 },
              },
            ]
          : []),
      ]}
      fitView
      preventScrolling={false}
      nodeTypes={nodeTypes}
      colorMode={colorMode}
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
};
