// import {
//   createAbstractOptimisticModel,
//   stopInjection,
//   type OptimisticUpdateOptionsSet
// } from "@optimistic-updates/core";
// import {
//   matchMutation,
//   matchQuery,
//   type MutationFilters,
//   Query,
//   type MutationObserverResult,
//   type QueryClient,
//   type QueryFilters,
//   type QueryKey,
//   type QueryObserverOptions,
//   Mutation,
//   type MutationKey
// } from "@tanstack/query-core";
// import { partialMatchKey } from "./partialMatchKey";

// type asdf = Mutation<any, any, any, any>['state']['status']
// export function createOptimisticTanstackQueryModel(queryClient: QueryClient) {
//   const base = createAbstractOptimisticModel<
//     Query<any, any, any, any>,
//     QueryFilters,
//     string,
//     Mutation<any, any, any, any>,
//     MutationFilters,
//     number
//   >({
//     hashMutation: (m) => m.mutationId,
//     hashQuery: (q) => q.queryHash,
//     isMutationActive: (m) => m.state.status === "pending",
//     matchMutation,
//     matchQuery
//   });
//   queryClient.getMutationCache().subscribe((event) => {
//     if (event.type === "updated") {
//       base.onMutation(event.mutation);
//       const queryKeys = [...base.whichQueriesToUpdate(event.mutation)];
//       console.log({ queryKeys });

//       const predicate = (q: Query<unknown, Error, unknown>): boolean => {
//         console.log({ q });
//         return queryKeys.some((filter) => matchQuery(filter, q));
//       };

//       if (event.mutation.state.status !== "success") {
//         for (const query of queryClient.getQueryCache().findAll({
//           predicate
//         })) {
//           console.log({ query });
//           queryClient.setQueryData(query.queryKey, (data: unknown) =>
//             base.wrapValue(data, query, true)
//           );
//         }
//       } else {
//         console.log("invalidate", event);
//         void queryClient.invalidateQueries({ predicate });
//       }
//     }
//   });
//   queryClient.getQueryCache().subscribe((event) => {
//     if (event.type === "removed") {
//       base.onQueryCacheExpired(event.query);
//     }
//   });
//   return {
//     watchMutation,
//     postprocessQuery: base.postprocessQuery,
//     wrapOptions
//   };

//   function wrapOptions<
//     T,
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     Opts extends QueryObserverOptions<T, any, any, any, QueryKey, any>
//   >(options: Opts): Opts {
//     const { queryFn } = options;
//     return {
//       ...options,
//       queryFn:
//         typeof queryFn !== "function"
//           ? queryFn
//           : async (params) => {
//               const result = await queryFn(params);
//               // TODO fix this hack (cast is completely wrong)
//               return base.wrapValue(result, options as any as Query, false);
//             }
//     };
//   }

//   function watchMutation<Data, TContext>(
//     filter: MutationFilters,
//     init: (m: MutationObserverResult<Data>) => TContext
//   ) {
//     return base.watchMutation(
//       filter,
//       (m) => init(toObserverResult<Data>(m)),
//       toObserverResult<Data>
//     );
//   }
//   type MutationWatch = ReturnType<typeof watchMutation>;
//   type MutationWatchGroup = OptimisticUpdateOptionsSet<MutationWatch>;
//   type CurrentMutationState<MutationTypes extends MutationWatchGroup> = {
//     [K in keyof MutationTypes]: {
//       state: MutationObserverResult<MutationTypes[K]>;
//       context: MutationTypes[K]["current"] extends Iterable<infer TContext>
//         ? TContext
//         : never;
//     };
//   };
// }

// function toObserverResult<Data = unknown>(m: Mutation<any, any, any, any>) {
//   return {
//     ...m.state,
//     isPending: m.state.status === "pending",
//     isSuccess: m.state.status === "success",
//     isError: m.state.status === "error",
//     isIdle: m.state.status === "idle"
//   } as MutationObserverResult<Data>;
// }
