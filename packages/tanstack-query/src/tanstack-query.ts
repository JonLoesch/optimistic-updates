import {
  createAbstractOptimisticModel,
  defaultResultState,
  type _WatchMutationResultFunc
} from "@optimistic-updates/core";
export { stopInjection } from "@optimistic-updates/core";
import {
  matchMutation,
  matchQuery,
  type MutationFilters,
  Query,
  type QueryClient,
  type QueryFilters,
  type QueryKey,
  type QueryObserverOptions
} from "@tanstack/query-core";
import { Observable, Subject } from "rxjs";

export type { InferWatchedType } from "@optimistic-updates/core";

type G = {
  Query: Query<unknown, unknown, unknown>;
  QueryLocator: QueryFilters;
  QueryHash: string;
  MutationLocator: MutationFilters;
};

export type OptimisticUpdateTanstackQueryModel = ReturnType<
  typeof createOptimisticTanstackQueryModel
>["model"];

export function createOptimisticTanstackQueryModel(queryClient: QueryClient) {
  const { model, hooks } = createAbstractOptimisticModel<G>({
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
    mutations$: new Observable((subscriber) => {
      const completionHooks = new Map<number, Subject<unknown>>();
      queryClient.getMutationCache().subscribe((event) => {
        if (event.type === "updated") {
          if (event.mutation.state.status === "pending") {
            const data$ = new Subject<unknown>();
            completionHooks.set(event.mutation.mutationId, data$);
            subscriber.next({
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              input: event.mutation.state.variables,
              isMatch(ml) {
                return matchMutation(ml, event.mutation);
              },
              data$
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
    })
  });
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === "removed") {
      hooks.onQueryCacheExpired(event.query.queryHash);
    }
  });
  return {
    model: {
      ...model,
      watchMutation<
        Input,
        Data,
        F extends _WatchMutationResultFunc<Input, Data>
      >(ml: G["MutationLocator"], fn: F) {
        return model.watchMutation(ml, defaultResultState<Input, Data, F>(fn));
      }
    },
    hooks: {
      wrapOptions
    }
  };

  function wrapOptions<
    T,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Opts extends QueryObserverOptions<T, any, any, any, QueryKey, any>
  >(options: Opts): Opts {
    const { queryFn } = options;
    return {
      ...options,
      queryFn:
        typeof queryFn !== "function"
          ? queryFn
          : async (params) => {
              const result = await queryFn(params);
              // TODO fix this hack (cast is completely wrong)
              return hooks.wrapValue(result, options as unknown as G["Query"]);
            }
    };
  }
}
