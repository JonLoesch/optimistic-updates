import { optimisticEngineTanstackQuery } from "@optimistic-updates/tanstack-query";
export {
  stopInjection,
  type MutationState,
  type OptimisticUpdateEngineTanstackQuery as OptimisticUpdateEngineReactQuery,
} from "@optimistic-updates/tanstack-query";
import { QueryClient, QueryFunction, useQuery } from "@tanstack/react-query";

export function optimisticEngineReactQuery(queryClient: QueryClient) {
  const { engine, hooks } = optimisticEngineTanstackQuery(queryClient);
  return {
    engine,
    makeUseEngineHook: (base?: typeof useQuery) => {
      return ((options) =>
        (base ?? useQuery)(
          options.queryFn
            ? ({ ...options, queryFn: hooks.wrapQueryFn(options.queryFn as QueryFunction) } as typeof options)
            : options
        )) as typeof useQuery;
    },
  };
}
