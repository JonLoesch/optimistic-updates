import {
  matchMutation,
  matchQuery,
  Mutation,
  MutationCache,
  MutationFilters,
  MutationKey,
  MutationObserverResult,
  QueriesObserver,
  Query,
  QueryCache,
  QueryClient,
  QueryFilters,
  QueryFunctionContext,
  QueryKey,
  QueryObserver,
  SetDataOptions
} from "@tanstack/react-query";
import {
  _MutationObserver,
  _MutationObserverOptions,
  _MutationObserverResult,
  _Query
} from "./def";

export const stopInjection = Symbol("stopInjection");
type MutationCacheNotifyEvent = Parameters<MutationCache["notify"]>[0];

export function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  return map.has(key) ? map.get(key)! : map.set(key, create()).get(key)!;
}

type QueryHandler = {
  transformData: <T>(data: T) => T | typeof stopInjection;
  hasStopped: boolean;
};

type MutationHandler<T> = {
  onChange: (result: MutationObserverResult<any, any, T, any>) => void;
  unsubscribe: () => void;
};

export class InjectionPrimitives {
  readonly #queryClient: QueryClient;
  constructor(queryClient: QueryClient) {
    this.#queryClient = queryClient;

    monkeyPatch(
      QueryCache.prototype,
      InjectableQueryCache.prototype,
      queryClient.getQueryCache()
    )!.transformer = <Data>(query: Query, data: Data) =>
      this.#transformValue(query, data);

    this.#queryClient.getMutationCache().subscribe((event) => {
      this.onMutationUpdate(event);
    });
  }
  #injections = new DynamicHandlers<Query, QueryHandler>();
  #unalteredValues = new Map<string, unknown>();
  injectQueryData<Data>(
    filters: QueryFilters,
    emptyDefaultIfTransformBeforeServerValue: Data,
    makeHandler: (query: Query) => {
      transformData: (data: Data) => Data | typeof stopInjection;
    }
  ) {
    const refresh = () => {
      this.#injections.deferCleanupTillEnd(() => {
        for (const query of this.#queryClient
          .getQueryCache()
          .findAll(filters)) {
          this.#queryClient.setQueryData(query.queryKey, (lastData: Data) => {
            const lastUnaltered = this.#unalteredValues
              .set(
                query.queryHash,
                this.#unalteredValues.get(query.queryHash) ??
                  lastData ??
                  emptyDefaultIfTransformBeforeServerValue
              )
              .get(query.queryHash);
            return this.#transformValue(query, lastUnaltered);
          });
        }
      });
      hasRefreshedAtLeastOnce = true;
    };

    const handlers = new Map<string, QueryHandler>();
    let hasRefreshedAtLeastOnce = false;
    const { unsubscribe } = this.#injections.addLayer({
      canUnsubscribe() {
        return (
          hasRefreshedAtLeastOnce &&
          handlers.values().every((x) => x.hasStopped)
        );
      },
      handler(query) {
        if (!matchQuery(filters, query)) return noMatch;
        return getOrCreate(handlers, query.queryHash, () => ({
          transformData: makeHandler(query).transformData as <T>(
            data: T
          ) => T | typeof stopInjection,
          hasStopped: false
        }));
      },
      onUnsubscribe() {
        refresh();
      }
    });

    const invalidateAndRefetch = () => {
      this.#queryClient.invalidateQueries(filters);
    };

    return { refresh, unsubscribe, invalidateAndRefetch };
  }

  #transformValue<T>(query: Query, unaltered: T): T {
    let isAltered = false;
    let value = unaltered;

    for (const [handler, unsubscribeIfAble] of this.#injections.active(query)) {
      if (handler.hasStopped) continue;
      const newValue = handler.transformData(value);
      if (newValue === stopInjection) {
        handler.hasStopped = true;
        unsubscribeIfAble();
      } else {
        value = newValue;
        isAltered = true;
      }
    }

    if (isAltered) {
      this.#unalteredValues.set(query.queryHash, unaltered);
    } else {
      this.#unalteredValues.delete(query.queryHash);
    }

    return value;
  }

  #mutations = new DynamicHandlers<
    Mutation,
    {
      onChange: (result: MutationObserverResult<any, any, any, any>) => void;
    }
  >();
  watchMutationEvents<T>(
    filters: MutationFilters,
    makeHandler: (mutation: Mutation) => MutationHandler<T>
  ): {
    unsucscribe: () => void;
  } {
    const mutations = new Map<number, MutationHandler<T>>();
    const allCleanups: Array<() => void> = [];
    return {
      unsucscribe: this.#mutations.addLayer({
        onUnsubscribe() {
          mutations.values().forEach((x) => x.unsubscribe());
        },
        handler(mutation) {
          if (!matchMutation(filters, mutation)) return noMatch;
          return getOrCreate(mutations, mutation.mutationId, () =>
            makeHandler(mutation)
          );
        }
      }).unsubscribe
    };
  }

  onMutationUpdate(event: MutationCacheNotifyEvent) {
    if (event.type === "updated") {
      if (event.mutation.state.status === "error") {
        console.error(event.mutation.state.error);
      }
      const state = {
        ...event.mutation.state,
        isPending: event.mutation.state.status === "pending",
        isSuccess: event.mutation.state.status === "success",
        isError: event.mutation.state.status === "error",
        isIdle: event.mutation.state.status === "idle"
      } as MutationObserverResult;
      for (const [handler] of this.#mutations.active(event.mutation)) {
        handler.onChange(state);
      }
    }
  }

  alter<
    T = unknown,
    TQueryKey extends QueryKey = QueryKey,
    TPageParam = never,
    TMutationKeys extends Record<string, MutationKey> = {},
    TMutationResults extends Record<
      string,
      Array<
        MutationObserverResult & {
          stopInjection: () => void;
          mutationId: number;
        }
      >
    > = Record<
      string,
      Array<
        MutationObserverResult & {
          stopInjection: () => void;
          mutationId: number;
        }
      >
    >
  >(
    key: TQueryKey,
    mutationKeys: TMutationKeys,
    alteration: () => (
      context: QueryFunctionContext<TQueryKey, TPageParam>,
      mutationResults: TMutationResults,
      result: T
    ) => typeof stopInjection | T
  ) {}
}
new InjectionPrimitives(new QueryClient()).alter(
  ["todos"],
  { additions: ["addTodo"], deletions: ["removeTodo"] },
  () => {
    const fakes = new Map<number, object>();
    return (context, mutationResults, result) => {
      const additions = mutationResults.additions.map((a) => {
        if (a.isError) a.stopInjection;
        return getOrCreate(fakes, a.mutationId, () => ({
          someValue: a.variables.value
        }));
      });

      return [...result, ...additions];
    };
  }
);

class InjectableQueryCache extends QueryCache {
  transformer: <T>(query: Query, data: T) => T = undefined as any;
  add(query: Query): void {
    monkeyPatch(
      Query.prototype,
      InjectableQuery.prototype,
      query
    )!.transformer = this.transformer;
    return super.add(query);
  }
}
class InjectableQuery extends Query {
  transformer: <T>(query: Query, data: T) => T = undefined as any;
  setData(newData: any, options?: SetDataOptions & { manual: boolean }) {
    if (options?.manual !== true) {
      newData = this.transformer(this, newData);
    }
    return super.setData(newData, options);
  }
}

function monkeyPatch<Parent extends object, Child extends object>(
  parentPrototype: Parent,
  childPrototype: Child,
  object: Parent
) {
  if (Object.getPrototypeOf(childPrototype) !== parentPrototype) {
    throw new Error();
  }
  if (parentPrototype.isPrototypeOf(object)) {
    Object.setPrototypeOf(object, childPrototype);
    return object as unknown as Child;
  } else if (childPrototype.isPrototypeOf(object)) {
    return object as unknown as Child;
  } else {
    throw new Error();
  }
}

export const noMatch = Symbol("noMatch");

interface DynamicLayer<Key, Handler> {
  onUnsubscribe?: () => void;
  handler: (key: Key) => Handler | typeof noMatch;
  canUnsubscribe?: () => boolean;
}
export class DynamicHandlers<Key, Handler> {
  #inc = 0;
  #all: DynamicLayer<Key, Handler>[] = [];
  addLayer(layer: DynamicLayer<Key, Handler>) {
    const index = this.#inc++;
    this.#all[index] = layer;
    return {
      unsubscribe: () => {
        layer.onUnsubscribe?.();
        delete this.#all[index];
      }
    };
  }
  #unsubscribeIfAble(index: number) {
    const layer = this.#all[index];
    if (layer.canUnsubscribe?.() === true) {
      layer.onUnsubscribe?.();
      delete this.#all[index];
    }
  }
  #deferredCleanups?: Array<() => void>;
  #cleanupEventually(fn: () => void) {
    if (this.#deferredCleanups) {
      this.#deferredCleanups.push(fn);
    } else {
      fn();
    }
  }
  deferCleanupTillEnd<T>(proc: () => T): T {
    if (this.#deferredCleanups) {
      return proc();
    } else {
      try {
        this.#deferredCleanups = [];
        const result = proc();
        this.#deferredCleanups.forEach((p) => p());
        return result;
      } finally {
        this.#deferredCleanups = undefined;
      }
    }
  }
  active(key: Key) {
    return this.deferCleanupTillEnd(() => this.#active(key));
  }
  *#active(key: Key): Iterable<[Handler, () => void]> {
    for (const [index, layer] of this.#all.entries()) {
      const handler = layer.handler(key);
      if (handler === noMatch) continue;
      yield [
        handler,
        () => this.#cleanupEventually(() => this.#unsubscribeIfAble(index))
      ];
    }
  }
}
