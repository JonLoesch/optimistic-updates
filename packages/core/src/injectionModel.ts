import { getOrCreate } from "./getOrCreate";
import { noMatch, SubscriptionManager } from "./subscriptionManager";

export const stopInjection = Symbol("stopInjection");

function handleStopInjection<T>(
  transform: (data: T) => T | typeof stopInjection,
  onStopInjection: () => void
): (data: T) => T {
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

type OptimisticUpdateGenericParameters = {
  Query: any;
  QueryLocator: any;
  QueryHash: PropertyKey;
  Mutation: any;
  MutationLocator: any;
  MutationHash: PropertyKey;
};

type Implementation<G extends OptimisticUpdateGenericParameters> = {
  isMutationErrored: (m: G["Mutation"]) => boolean;
  isMutationSuccessful: (m: G["Mutation"]) => boolean;
  hashQuery: (q: G["Query"]) => G["QueryHash"];
  hashMutation: (m: G["Mutation"]) => G["MutationHash"];
  matchQuery: (ql: G["QueryLocator"], q: G["Query"]) => boolean;
  matchMutation: (ml: G["MutationLocator"], m: G["Mutation"]) => boolean;
  updateCache: (
    qls: G["QueryLocator"][],
    updater: <T>(data: T, qh: G["QueryHash"]) => T
  ) => void;
  triggerRefetch: (qls: G["QueryLocator"][]) => void;
};

type MutationState<Data, TExtraInitData> = Data & TExtraInitData;
export type MutationWatch<
  G extends OptimisticUpdateGenericParameters,
  Data,
  TExtraInitData
> = {
  ml: G["MutationLocator"];
  current: Iterable<MutationState<Data, TExtraInitData>>;
  clearCache: () => void;
};

export type MutationWatchGroup<G extends OptimisticUpdateGenericParameters> =
  Record<string, MutationWatch<G, any, any>>;

export type CurrentMutationState<
  G extends OptimisticUpdateGenericParameters,
  Group extends MutationWatchGroup<G>
> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof Group]: Group[K] extends MutationWatch<G, any, any>
    ? Group[K]["current"] extends Iterable<infer T>
      ? T[]
      : never
    : never;
};

export function createAbstractOptimisticModel<
  G extends OptimisticUpdateGenericParameters
>(impl: Implementation<G>) {
  const queryInjections = new SubscriptionManager<
    G["QueryHash"],
    G["Query"],
    {
      transform: <T>(data: T) => T;
    }
  >();
  const mutationWatchers = new SubscriptionManager<
    G["MutationHash"],
    G["Mutation"],
    {
      mutationUpdate: (value: G["Mutation"]) => void;
    }
  >();
  const refreshMap = new SubscriptionManager<
    G["MutationHash"],
    G["Mutation"],
    G["QueryLocator"]
  >();
  const unalteredValues = new Map<G["QueryHash"], unknown>();
  let autoInc = 0;

  function watchMutation<Data, TExtraInitData>(
    ml: G["MutationLocator"],
    init: (m: G["Mutation"]) => TExtraInitData,
    data: (m: G["Mutation"]) => Data
  ): MutationWatch<G, Data, TExtraInitData> {
    const values = new Map<number, MutationState<Data, TExtraInitData>>();

    const layer = mutationWatchers.addLayer({
      createItem: (m, lifecycle) => {
        if (!impl.matchMutation(ml, m)) {
          return noMatch;
        }
        const index = autoInc++;
        const context = init(m);
        return {
          item: {
            mutationUpdate: (latest) => {
              if (impl.isMutationErrored(latest)) {
                lifecycle.cleanupItem();
              } else {
                values.set(index, { ...data(latest), ...context });
              }
            }
          },
          onCleanupItem: () => values.delete(index)
        };
      }
    });

    return {
      ml,
      current: {
        [Symbol.iterator]: () => values.values()
      },
      clearCache: layer.clearCache
    };
  }
  function currentState<Group extends MutationWatchGroup<G>>(
    mutationGroup: Group
  ): CurrentMutationState<G, Group> {
    const result = Object.fromEntries(
      Object.entries(mutationGroup).map(([name, m]) => [name, [...m.current]])
    ) as CurrentMutationState<G, Group>;
    return result;
  }
  function postprocessQuery<Group extends MutationWatchGroup<G>, Data>(
    ql: G["QueryLocator"],
    watcherGroup: Group,
    transform: (
      value: Data,
      mutationState: CurrentMutationState<G, Group>,
      query: G["Query"]
    ) => Data | typeof stopInjection
  ) {
    queryInjections.addLayer({
      createItem: (q) => {
        if (impl.matchQuery(ql, q)) {
          return {
            item: {
              transform: handleStopInjection<Data>(
                (data) => transform(data, currentState(watcherGroup), q),
                () => {
                  console.log("poostProcess stop injection");
                  for (const w of Object.values(watcherGroup)) {
                    w.clearCache();
                  }
                }
              ) as <T>(data: T) => T
            }
          };
        } else {
          return noMatch;
        }
      }
    });
    refreshMap.addLayer({
      createItem: (mutation) => {
        if (
          Object.values(watcherGroup).some((w) =>
            impl.matchMutation(w.ml, mutation)
          )
        ) {
          return { item: ql };
        } else {
          return noMatch;
        }
      }
    });
  }
  function transformer<Data>(
    unaltered: Data,
    qh: G["QueryHash"],
    injections: ReturnType<typeof queryInjections.get>
  ): Data {
    let isAltered = false;
    let value = unaltered;

    for (const handler of injections) {
      const newValue = handler.item.transform(value);
      if (newValue !== value) {
        isAltered = true;
      }
      value = newValue;
    }

    if (isAltered) {
      unalteredValues.set(qh, unaltered);
    } else {
      unalteredValues.delete(qh);
    }

    return value;
  }

  function wrapValue<Data>(unaltered: Data, query: G["Query"]) {
    const queryHash = impl.hashQuery(query);
    const newLocal = queryInjections.getOrCreate(queryHash, query);
    return transformer(unaltered, queryHash, newLocal);
  }
  function onMutation(m: G["Mutation"]) {
    for (const watcher of mutationWatchers.getOrCreate(
      impl.hashMutation(m),
      m
    )) {
      watcher.item.mutationUpdate(m);
    }
    const filters = [...refreshMap.getOrCreate(impl.hashMutation(m), m)].map(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      (x) => x.item
    );
    if (impl.isMutationSuccessful(m)) {
      impl.triggerRefetch(filters);
    } else {
      impl.updateCache(filters, <T>(data: T, hash: G["QueryHash"]) => {
        return transformer(
          (unalteredValues.get(hash) as T | undefined) ?? data,
          hash,
          queryInjections.get(hash)
        );
      });
    }
  }
  function onQueryCacheExpired(qh: G["QueryHash"]) {
    for (const i of queryInjections.get(qh)) {
      i.cleanupItem();
    }
  }

  return {
    model: {
      watchMutation,
      postprocessQuery
    },
    hooks: {
      wrapValue,
      onMutation,
      onQueryCacheExpired
    }
  };
}
