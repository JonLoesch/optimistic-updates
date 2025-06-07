/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { optimisticEngineReactQuery } from "@optimistic-updates/react-query";
import { QueryClient, useQuery as useQuerySkipOptimistic } from "@tanstack/react-query";
export { useQuery as useQuerySkipOptimistic } from "@tanstack/react-query";
import { addOptimisticUpdates } from "./optimistic-updates";

export const queryClient = new QueryClient();
const { engine, makeUseEngineHook } = optimisticEngineReactQuery(queryClient);
export const useQuery = makeUseEngineHook(useQuerySkipOptimistic);
addOptimisticUpdates(engine);

export async function get(url: string, vars?: unknown) {
  const raw = await fetch(
    `http://localhost:3033/${url}?${new URLSearchParams(vars ? { input: JSON.stringify(vars) } : undefined)}`
  );
  const json = await raw.json();
  if (json.error) {
    throw new Error(json.error);
  }
  return json.result.data;
}
export async function post(url: string, input: unknown) {
  const raw = await fetch(`http://localhost:3033/${url}`, {
    method: "post",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const json = await raw.json();
  if (json.error) {
    throw new Error(json.error);
  }
  return json.result.data;
}
