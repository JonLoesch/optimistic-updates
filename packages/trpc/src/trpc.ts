import type { AnyTRPCRouter } from "@trpc/server";
import type {
  TRPCMutationKey,
  TRPCOptionsProxy,
  TRPCQueryKey
} from "@trpc/tanstack-react-query";
import {
  matchQuery,
  type QueryClient,
  type QueryFilters
} from "@tanstack/query-core";
import type {
  Operation,
  OperationResultEnvelope,
  TRPCLink
} from "@trpc/client";

import { map, tap } from "@trpc/server/observable";
import {
  createAbstractOptimisticModel,
  stopInjection,
  type MutationWatch,
  type MutationState as CoreMutationState,
  defaultResultState,
  type _WatchMutationResultFunc,
  type ResultOf
} from "@optimistic-updates/core";
import { Observable, type ObservedValueOf, Subject } from "rxjs";

interface TRPCTypeProxy {
  "~types": {
    input: any;
    output: any;
    errorShape: any;
  };
}

interface TRPCQuery extends TRPCTypeProxy {
  queryKey: () => TRPCQueryKey;
}
interface TRPCMutation extends TRPCTypeProxy {
  mutationKey: () => TRPCMutationKey;
}

type Packet<
  Type extends Operation["type"],
  TInput = any,
  TOutput = any,
  TError = any
> = Omit<Operation<TInput>, "type"> & {
  type: Type;
} & (
    | {
        status: "error";
        error: TError;
        result: null;
      }
    | {
        status: "pending";
        error: null;
        result: null;
      }
    | {
        status: "success";
        error: null;
        result: TOutput;
      }
  );

type MutationState<T extends TRPCMutation> = Pick<
  Packet<
    "mutation",
    T["~types"]["input"],
    T["~types"]["output"],
    T["~types"]["errorShape"]
  >,
  "input" | "status" | "error" | "result"
>;

type G = {
  Query: Packet<"query">;
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
    hashQuery: (q) => q.path,
    matchQuery: (ql, q) =>
      q.path.startsWith((ql.queryKey()[0] as string[]).flat().join(".")),
    triggerRefetch: (ql) => {
      void queryClient.invalidateQueries(filterQueries(ql));
    },
    updateCache: (ql, updater) => {
      for (const [queryKey] of queryClient.getQueriesData(filterQueries(ql))) {
        queryClient.setQueryData(queryKey, (data: unknown) => {
          return updater(data, (queryKey[0] as string[]).flat().join("."));
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
        return next(op).pipe(
          map((response) => {
            return {
              ...response,
              result: {
                ...response.result,
                data:
                  response.result.type === "data"
                    ? hooks.wrapValue(response.result.data, {
                        ...op,
                        type: "query",
                        status: "success",
                        result: response.result.data,
                        error: null
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
      >(ml: ML, fn?: F) {
        return model.watchMutation(
          ml,
          defaultResultState<ML["~types"]["input"], ML["~types"]["output"], F>(
            fn!
          )
        );
      }
    },
    link
  };
}
