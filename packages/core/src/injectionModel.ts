/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import { getOrCreate } from "./getOrCreate";
import { noMatch, SubscriptionManager } from "./subscriptionManager";

export const stopInjection = Symbol("stopInjection");

function handleStopInjection(
  transform: <T>(data: T) => T | typeof stopInjection,
  onStopInjection: () => void
): <T>(data: T) => T {
  return (data) => {
    const transformed = transform(data);
    if (transformed === stopInjection) {
      onStopInjection();
      return data;
    } else {
      return transformed;
    }
  };
}

export function abstractModel<
  Q,
  QL,
  QH extends PropertyKey,
  M,
  ML,
  MH extends PropertyKey
>(impl: {
  isMutationActive: (m: M) => boolean;
  hashQuery: (q: Q) => QH;
  hashMutation: (m: M) => MH;
  matchQuery: (ql: QL, q: Q) => boolean;
  matchMutation: (ml: ML, m: M) => boolean;
}) {
  const queryInjections = new SubscriptionManager<
    QH,
    Q,
    {
      transform: <T>(data: T) => T;
    }
  >();
  const mutationWatchers = new SubscriptionManager<
    MH,
    M,
    {
      mutationUpdate: (value: M) => void;
    }
  >();
  const refreshMap = new SubscriptionManager<MH, M, QL>();
  const unalteredValues = new Map<QH, unknown>();
  let autoInc = 0;
  const activeMutations = new Map<number, M>();

  mutationWatchers.addLayer({
    createHandler: (m, lifecycle) => {
      const index = autoInc++;
      activeMutations.set(index, m);
      return {
        mutationUpdate: (m) => {
          if (impl.isMutationActive(m)) {
            activeMutations.set(index, m);
          } else {
            lifecycle.cleanupHandler();
          }
        },
        onCleanupHandler: () => activeMutations.delete(index)
      };
    }
  });

  return {
    whichQueriesToUpdate(m: M) {
      return refreshMap.active(impl.hashMutation(m), m);
    },
    add: (
      queryPredicate: QL,
      mutationPredicates: Record<string, ML>,
      processor: <Data>(
        value: Data,
        mutations: Record<string, M[]>,
        context: Q
      ) => Data | typeof stopInjection
    ) => {
      queryInjections.addLayer({
        createHandler: (q) => {
          if (impl.matchQuery(queryPredicate, q)) {
            let mutationState = latestActiveMutationState();
            function latestActiveMutationState(): Record<
              string,
              Map<number, M>
            > {
              return Object.fromEntries(
                Object.entries(mutationPredicates).map(([name, pred]) => [
                  name,
                  new Map(
                    [...activeMutations].filter(([_, m]) =>
                      impl.matchMutation(pred, m)
                    )
                  )
                ])
              );
            }

            let watch = newMutationWatcher();
            function newMutationWatcher() {
              return mutationWatchers.addLayer({
                createHandler: (m) => {
                  for (const [name, pred] of Object.entries(
                    mutationPredicates
                  )) {
                    if (impl.matchMutation(pred, m)) {
                      const index = autoInc++;
                      mutationState[name]!.set(index, m);
                      return {
                        mutationUpdate: (m) => {
                          mutationState[name]!.set(index, m);
                        },
                        onCleanupHandler: () => {}
                      };
                    }
                  }
                  return noMatch;
                }
              });
            }

            return {
              transform: handleStopInjection(
                (data) =>
                  processor(
                    data,
                    Object.fromEntries(
                      Object.entries(mutationState).map(([name, m]) => [
                        name,
                        [...m.values()]
                      ])
                    ),
                    q
                  ),
                () => {
                  watch.unsubscribe();
                  watch = newMutationWatcher();
                  mutationState = latestActiveMutationState();
                }
              ),
              onCleanupHandler: () => watch.unsubscribe()
            };
          } else {
            return noMatch;
          }
        }
      });
    },

    wrapValue: <Data>(
      unaltered: Data,
      query: Q,
      useUnalteredValueIfPresent: boolean
    ) => {
      const queryHash = impl.hashQuery(query);
      let isAltered = false;
      let value =
        (useUnalteredValueIfPresent && unalteredValues.get(queryHash)) ??
        unaltered;

      for (const handler of queryInjections.active(queryHash, query)) {
        const newValue = handler.transform(value);
        if (newValue !== value) {
          isAltered = true;
        }
        value = newValue;
      }

      if (isAltered) {
        unalteredValues.set(queryHash, unaltered);
      } else {
        unalteredValues.delete(queryHash);
      }

      return value;
    },
    onMutation: (m: M) => {
      for (const handler of mutationWatchers.active(impl.hashMutation(m), m)) {
        handler.mutationUpdate(m);
      }
    },
    onQueryCacheExpired: (q: Q) => {
      for (const handler of queryInjections.active(impl.hashQuery(q), q)) {
        handler.cleanupHandler();
      }
    }
  };
}
