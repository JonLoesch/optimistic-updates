import type { AnyTRPCRouter } from "@trpc/server";
import { hashKey, type QueryClient } from "@tanstack/query-core";
import type { TRPCLink } from "@trpc/client";

import { map, tap } from "@trpc/server/observable";
import { optimisticEngineCore } from "@optimistic-updates/core";
export { stopInjection } from "@optimistic-updates/core";
import { type ObservedValueOf, Subject } from "rxjs";
import type { Engine } from "./signatureBoilerplate";
export type { Engine as OptimisticUpdateEngineTRPC } from "./signatureBoilerplate";
import { G } from "./g";

export type OptimisticUpdateTRPCModel = ReturnType<typeof optimisticEngineTRPC>["engine"];
export function optimisticEngineTRPC<Router extends AnyTRPCRouter>(queryClient: QueryClient) {
  const mutations$ = new Subject<ObservedValueOf<Parameters<typeof optimisticEngineCore<G>>[0]["mutations$"]>>();
  const queryCacheExpirations$ = new Subject<
    ObservedValueOf<Parameters<typeof optimisticEngineCore<G>>[0]["queryCacheExpirations$"]>
  >();
  const { hooks, engine } = optimisticEngineCore<G>({
    hashQuery: (q) => hashKey([q.path, q.input]), // matches the react-query hash???
    matchQuery: (ql, q) => ql.queryKey()[0].every((v, index) => q.path[index] === v),
    queryInput: (q) => q.input,
    triggerRefetch: (ql) => {
      void queryClient.invalidateQueries({ queryKey: ql.queryKey() });
    },
    updateCache: (ql, updater) => {
      for (const query of queryClient.getQueryCache().findAll({ queryKey: ql.queryKey() })) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const input = (query.queryKey[1] as any).input;
        queryClient.setQueryData(query.queryKey, (data: unknown) => {
          return updater(data, { path: query.queryKey[0] as string[], input });
        });
      }
    },
    mutations$,
    queryCacheExpirations$,
  });
  queryClient.getQueryCache().subscribe((event) => {
    queryCacheExpirations$.next(event.type);
  });
  const link: TRPCLink<Router> =
    () =>
    ({ next, op }) => {
      if (op.type === "mutation") {
        const data$ = new Subject<ObservedValueOf<ObservedValueOf<typeof mutations$>["data$"]>>();
        mutations$.next({
          isMatch: (ml) => op.path.startsWith(ml.mutationKey().flat().join(".")),
          data$,
          input: op.input,
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
            },
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
                        path: op.path.split("."),
                        input: op.input as Record<string, unknown>,
                      })
                    : response.result.data,
              },
            } as typeof response;
          })
        );
      } else {
        return next(op);
      }
    };

  return {
    engine: engine as Engine,
    link,
  };
}
