import {
  createAbstractOptimisticModel,
  type MutationWatch
} from "@optimistic-updates/core";
export { stopInjection } from "@optimistic-updates/core";
import {
  matchMutation,
  matchQuery,
  type MutationFilters,
  Query,
  type MutationObserverResult,
  type QueryClient,
  type QueryFilters,
  type QueryKey,
  type QueryObserverOptions,
  Mutation,
  type MutationKey,
  hashKey,
  type MutationState,
  type DefaultError
} from "@tanstack/query-core";
import { partialMatchKey } from "./partialMatchKey";

type G = {
  Query: Query<any, any, any, any>;
  QueryLocator: QueryFilters;
  QueryHash: string;
  Mutation: Mutation<any, any, any, any>;
  MutationLocator: MutationFilters;
  MutationHash: number;
};

export type OptimisticUpdateTanstackQueryModel = ReturnType<
  typeof createOptimisticTanstackQueryModel
>["model"];

function unionFilter(qls: G["QueryLocator"][]): G["QueryLocator"] {
  return { predicate: (query) => qls.some((p) => matchQuery(p, query)) };
}
export function createOptimisticTanstackQueryModel(queryClient: QueryClient) {
  const { model, hooks } = createAbstractOptimisticModel<G>({
    hashMutation: (m) => m.mutationId,
    hashQuery: (q) => q.queryHash,
    matchMutation,
    matchQuery,
    isMutationErrored: (m) => m.state.status === "error",
    isMutationSuccessful: (m) => m.state.status === "success",
    triggerRefetch: (qls) =>
      void queryClient.invalidateQueries(unionFilter(qls)),
    updateCache: (qls, updater) => {
      for (const query of queryClient
        .getQueryCache()
        .findAll(unionFilter(qls))) {
        queryClient.setQueryData(query.queryKey, (data: unknown) => {
          return updater(data, query.queryHash);
        });
      }
    }
  });
  queryClient.getMutationCache().subscribe((event) => {
    if (event.type === "updated") {
      hooks.onMutation(event.mutation);
    }
  });
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === "removed") {
      hooks.onQueryCacheExpired(event.query.queryHash);
    }
  });
  return {
    model: {
      ...model,
      watchMutation
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
              return hooks.wrapValue(result, options as any as Query);
            }
    };
  }

  function watchMutation<TOutput, TError, TInput>(
    m: MutationFilters
  ): MutationWatch<G, MutationObserverResult<TOutput, TError, TInput>, unknown>;
  function watchMutation<TOutput, TError, TInput, TExtraInitData>(
    m: MutationFilters,
    init: (m: Mutation<TInput, TError, TOutput>) => TExtraInitData
  ): MutationWatch<
    G,
    MutationObserverResult<TOutput, TError, TInput>,
    TExtraInitData
  >;
  function watchMutation<TOutput, TError, TInput, TExtraInitData>(
    m: MutationFilters,
    init?: (m: Mutation<TOutput, TError, TInput>) => TExtraInitData
  ) {
    return model.watchMutation(
      m,
      init ?? ((() => {}) as Exclude<typeof init, undefined>),
      toObserverResult
    );
  }
}

function toObserverResult<Data = unknown>(m: Mutation<any, any, any, any>) {
  return {
    ...m.state,
    isPending: m.state.status === "pending",
    isSuccess: m.state.status === "success",
    isError: m.state.status === "error",
    isIdle: m.state.status === "idle"
  } as MutationObserverResult<Data>;
}
