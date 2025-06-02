import { optimisticEngineCore } from "@optimistic-updates/core";
import { matchMutation, matchQuery, QueryOptions, type QueryClient } from "@tanstack/query-core";
import { Observable, Subject } from "rxjs";
import { G } from "./g";
import { Engine } from "./signatureBoilerplate";

export function optimisticEngineTanstackQuery(queryClient: QueryClient) {
  const queryCacheExpirations$ = new Subject<string>();
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === "removed") {
      queryCacheExpirations$.next(event.query.queryHash);
    }
  });
  const { engine, hooks } = optimisticEngineCore<G>({
    hashQuery: (q) => q.queryHash,
    matchQuery,
    triggerRefetch: (ql) => void queryClient.invalidateQueries(ql),
    updateCache: (ql, updater) => {
      for (const query of queryClient.getQueryCache().findAll(ql)) {
        queryClient.setQueryData(query.queryKey, (data: unknown) => {
          return updater(data, query as G["Query"]);
        });
      }
    },
    queryInput: (q) => q.queryKey,
    queryCacheExpirations$,
    mutations$: new Observable((subscriber) => {
      const completionHooks = new Map<number, Subject<unknown>>();
      queryClient.getMutationCache().subscribe((event) => {
        if (event.type === "updated") {
          if (event.mutation.state.status === "pending") {
            const data$ = new Subject<unknown>();
            completionHooks.set(event.mutation.mutationId, data$);
            subscriber.next({
              input: event.mutation.state.variables,
              isMatch(ml) {
                return matchMutation(ml, event.mutation);
              },
              data$,
            });
          } else if (event.mutation.state.status === "error") {
            const data$ = completionHooks.get(event.mutation.mutationId);
            data$?.error(event.mutation.state.error);
            completionHooks.delete(event.mutation.mutationId);
          } else if (event.mutation.state.status === "success") {
            const data$ = completionHooks.get(event.mutation.mutationId);
            data$?.next(event.mutation.state.data);
            data$?.complete();
            completionHooks.delete(event.mutation.mutationId);
          }
        }
      });
    }),
  });
  return {
    engine: engine as Engine,
    hooks: {
      wrapQueryFn,
    },
  };

  function wrapQueryFn<Fn extends QueryOptions["queryFn"]>(queryFn: Fn): Fn {
    if (typeof queryFn !== "function") return queryFn;
    return (async (params) => {
      const result = await queryFn(params);
      // TODO handle undefined
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const query = queryClient.getQueryCache().find({ queryKey: params.queryKey, exact: true })!;
      return hooks.wrapValue(result, query as G["Query"]);
    }) as Fn;
  }
}
