import { abstractModel, stopInjection } from "@optimistic-updates/core";
import {
  hashKey,
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
  type MutationKey
} from "@tanstack/query-core";
import { partialMatchKey } from "./partialMatchKey";

export function optimisticTanstackQuery(queryClient: QueryClient) {
  const base = abstractModel<
    QueryKey,
    QueryKey,
    string,
    Mutation<any, any, any, any>,
    MutationFilters,
    number
  >({
    hashMutation: (m) => m.mutationId,
    hashQuery: (q) => hashKey(q),
    isMutationActive: (m) => m.state.status === "pending",
    matchMutation: (filter, m) => matchMutation(filter, m),
    matchQuery: (filter, q) => {
      return partialMatchKey(q, filter);
    }
  });
  queryClient.getMutationCache().subscribe((event) => {
    if (event.type === "updated") {
      base.onMutation(event.mutation);
      const queryKeys = [...base.whichQueriesToUpdate(event.mutation)];
      console.log({ queryKeys });

      const predicate = (q: Query<unknown, Error, unknown>): boolean => {
        console.log({ q });
        return queryKeys.some((queryKey) => matchQuery({ queryKey }, q));
      };

      if (event.mutation.state.status !== "success") {
        for (const query of queryClient.getQueryCache().findAll({
          predicate
        })) {
          console.log({ query });
          queryClient.setQueryData(query.queryKey, (data: unknown) =>
            base.wrapValue(data, query.queryKey, true)
          );
        }
      } else {
        console.log("invalidate", event);
        void queryClient.invalidateQueries({ predicate });
      }
    }
  });
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === "removed") {
      base.onQueryCacheExpired(
        (event.query as Query<unknown, unknown, unknown>).queryKey
      );
    }
  });
  return {
    add: base.add,
    wrapOptions
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
              return base.wrapValue(result, options.queryKey, false);
            }
    };
  }

  function add<Data, Names extends string>(
    queryKey: QueryKey,
    mutationFilters: Record<Names, MutationFilters>,
    processor: <Data>(
      value: Data,
      mutations: Record<Names, MutationObserverResult[]>,
      context: QueryKey
    ) => Data | typeof stopInjection
  ) {
    base.add(queryKey, mutationFilters, (value, mutations, query) => {
      return processor(
        value,
        Object.fromEntries(
          Object.entries(mutations).map(([k, v]) => [
            k,
            v.map(toObserverResult)
          ])
        ) as Record<Names, MutationObserverResult[]>,
        query
      );
    });
  }
}

function toObserverResult(m: Mutation) {
  return {
    ...m.state,
    isPending: m.state.status === "pending",
    isSuccess: m.state.status === "success",
    isError: m.state.status === "error",
    isIdle: m.state.status === "idle"
  } as MutationObserverResult;
}
