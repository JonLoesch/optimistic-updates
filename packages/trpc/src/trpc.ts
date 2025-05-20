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
  type CurrentMutationState,
  type MutationWatch,
  type MutationWatchGroup
} from "@optimistic-updates/core";

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
  Mutation: Packet<"mutation">;
  MutationLocator: TRPCMutation;
  MutationHash: number;
};

export type OptimisticUpdateTRPCModel = ReturnType<
  typeof createOptimisticTRPCModel
>["model"];
export function createOptimisticTRPCModel<Router extends AnyTRPCRouter>(
  queryClient: QueryClient
) {
  const { hooks, model } = createAbstractOptimisticModel<G>({
    hashMutation: (m) => m.id,
    hashQuery: (q) => q.path,
    isMutationErrored: (m) => m.status === "error",
    isMutationSuccessful: (m) => m.status === "success",
    matchMutation: (ml, m) =>
      m.path.startsWith(ml.mutationKey().flat().join(".")),
    matchQuery: (ql, q) =>
      q.path.startsWith((ql.queryKey()[0] as string[]).flat().join(".")),
    triggerRefetch: (qls) => {
      void queryClient.invalidateQueries(filterQueries(qls));
    },
    updateCache: (qls, updater) => {
      for (const [queryKey] of queryClient.getQueriesData(filterQueries(qls))) {
        queryClient.setQueryData(queryKey, (data: unknown) => {
          return updater(data, (queryKey[0] as string[]).flat().join("."));
        });
      }
    }
  });
  function filterQueries(qls: TRPCQuery[]): QueryFilters {
    return {
      predicate(query) {
        return qls.some((q) => matchQuery({ queryKey: q.queryKey() }, query));
      }
    };
  }
  queryClient.getQueryCache().subscribe((event) => {
    hooks.onQueryCacheExpired(event.type);
  });
  const link: TRPCLink<Router> =
    () =>
    ({ next, op }) => {
      if (op.type === "mutation") {
        hooks.onMutation({
          ...op,
          type: "mutation",
          status: "pending",
          result: null,
          error: null
        });
        return next(op).pipe(
          tap({
            next(response) {
              hooks.onMutation({
                ...op,
                type: "mutation",
                status: "success",
                result: response.result.data,
                error: null
              });
            },
            error(error) {
              hooks.onMutation({
                ...op,
                type: "mutation",
                status: "error",
                result: null,
                error
              });
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
      postprocessQuery<
        Group extends MutationWatchGroup<G>,
        QL extends G["QueryLocator"]
      >(
        ql: QL,
        watcherGroup: Group,
        transform: (
          value: QL["~types"]["output"],
          mutationState: CurrentMutationState<G, Group>,
          query: G["Query"]
        ) => QL["~types"]["output"] | typeof stopInjection
      ) {
        return model.postprocessQuery(ql, watcherGroup, transform);
      },
      watchMutation
    },
    link
  };
  function watchMutation<M extends TRPCMutation>(
    m: M
  ): MutationWatch<G, MutationState<M>, unknown>;
  function watchMutation<M extends TRPCMutation, TExtraInitData>(
    m: M,
    init: (m: Packet<"mutation">) => TExtraInitData
  ): MutationWatch<G, MutationState<M>, TExtraInitData>;
  function watchMutation<M extends TRPCMutation, TExtraInitData = {}>(
    m: M,
    init?: (m: Packet<"mutation">) => TExtraInitData
  ) {
    return model.watchMutation(
      m,
      init ?? ((() => {}) as Exclude<typeof init, undefined>),
      (x) => x as MutationState<M>
    );
  }
}
