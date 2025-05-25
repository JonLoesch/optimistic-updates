import type { AnyTRPCRouter } from "@trpc/server";
import type { TRPCMutationKey, TRPCQueryKey } from "@trpc/tanstack-react-query";
import {
  hashKey,
  type QueryClient,
  type QueryFilters
} from "@tanstack/query-core";
import type { TRPCLink } from "@trpc/client";

import { map, tap } from "@trpc/server/observable";
import {
  createAbstractOptimisticModel,
  stopInjection,
  type MutationWatch,
  defaultResultState,
  type _WatchMutationResultFunc
} from "@optimistic-updates/core";
export { stopInjection } from "@optimistic-updates/core";
import { type ObservedValueOf, Subject } from "rxjs";

interface TRPCTypeProxy {
  "~types": {
    input: unknown;
    output: unknown;
    errorShape: unknown;
  };
}

interface TRPCQuery extends TRPCTypeProxy {
  queryKey: () => TRPCQueryKey;
}
interface TRPCMutation extends TRPCTypeProxy {
  mutationKey: () => TRPCMutationKey;
}

type G = {
  Query: {
    path: string[];
    input: Record<string, unknown>;
  };
  QueryLocator: TRPCQuery;
  QueryHash: string;
  MutationLocator: TRPCMutation;
};

export type OptimisticUpdateTRPCModel = ReturnType<
  typeof createOptimisticTRPCModel
>["model"];
export function createOptimisticTRPCModel<Router extends AnyTRPCRouter>(
  queryClient: QueryClient
) {
  const mutations$ = new Subject<
    ObservedValueOf<
      Parameters<typeof createAbstractOptimisticModel<G>>[0]["mutations$"]
    >
  >();
  const { hooks, model } = createAbstractOptimisticModel<G>({
    hashQuery: (q) => hashKey([q.path, { type: "query", ...q.input }]), // matches the react-query hash
    matchQuery: (ql, q) =>
      ql.queryKey()[0].every((v, index) => q.path[index] === v),
    triggerRefetch: (ql) => {
      void queryClient.invalidateQueries(filterQueries(ql));
    },
    updateCache: (ql, updater) => {
      for (const query of queryClient
        .getQueryCache()
        .findAll({ queryKey: ql.queryKey() })) {
        const input = {}; // TODO this is wrong
        console.log({ input, queryKey: query.queryKey });
        queryClient.setQueryData(query.queryKey, (data: unknown) => {
          console.log("queryKey", query.queryKey);
          return updater(data, { path: query.queryKey[0] as string[], input });
        });
      }
    },
    mutations$
  });
  function filterQueries(ql: TRPCQuery): QueryFilters {
    return {
      queryKey: ql.queryKey()
    };
  }
  queryClient.getQueryCache().subscribe((event) => {
    hooks.onQueryCacheExpired(event.type);
  });
  const link: TRPCLink<Router> =
    () =>
    ({ next, op }) => {
      if (op.type === "mutation") {
        const data$ = new Subject<
          ObservedValueOf<ObservedValueOf<typeof mutations$>["data$"]>
        >();
        mutations$.next({
          isMatch: (ml) =>
            op.path.startsWith(ml.mutationKey().flat().join(".")),
          data$,
          input: op.input
        });
        return next(op).pipe(
          tap({
            next(response) {
              data$.next(response.result.data);
            },
            error(error) {
              data$.error(error);
            },
            complete() {
              data$.complete();
            }
          })
        );
      } else if (op.type === "query") {
        console.log({ op });
        return next(op).pipe(
          map((response) => {
            return {
              ...response,
              result: {
                ...response.result,
                data:
                  response.result.type === "data"
                    ? hooks.wrapValue(response.result.data, {
                        path: op.path.split("."),
                        input: op.input as Record<string, unknown>
                      })
                    : response.result.data
              }
            } as typeof response;
          })
        );
      } else {
        return next(op);
      }
    };
  return {
    model: {
      postprocessQuery<Result, QL extends G["QueryLocator"]>(
        ql: QL,
        watch: MutationWatch<Result>,
        transform: (
          value: QL["~types"]["output"],
          mutationState: Result,
          query: G["Query"]
        ) => QL["~types"]["output"] | typeof stopInjection
      ) {
        return model.postprocessQuery(ql, watch, transform);
      },
      watchMutation<
        ML extends G["MutationLocator"],
        F extends _WatchMutationResultFunc<
          ML["~types"]["input"],
          ML["~types"]["output"]
        >
      >(ml: ML, fn: F) {
        return model.watchMutation(
          ml,
          defaultResultState<ML["~types"]["input"], ML["~types"]["output"], F>(
            fn
          )
        );
      }
    },
    link
  };
}
