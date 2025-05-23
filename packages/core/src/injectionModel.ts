import { filter, map, Observable, startWith, type Subscribable } from "rxjs";
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
  MutationLocator: any;
};

type Implementation<G extends OptimisticUpdateGenericParameters> = {
  hashQuery: (q: G["Query"]) => G["QueryHash"];
  matchQuery: (ql: G["QueryLocator"], q: G["Query"]) => boolean;
  updateCache: (
    ql: G["QueryLocator"],
    updater: <T>(data: T, qh: G["QueryHash"]) => T
  ) => void;
  triggerRefetch: (ql: G["QueryLocator"]) => void;
  mutations$: Observable<{
    input: any;
    isMatch: (ml: G["MutationLocator"]) => boolean;
    data$: Observable<any>;
  }>;
};

export type MutationState<Data> =
  | {
      status: "pending";
      data: undefined;
    }
  | {
      status: "success";
      data: Data;
    };
type InternalMutationState<Result> = {
  status: "pending" | "success";
  result: Result;
};

export type MutationWatch<Result> = Subscribable<
  Subscribable<InternalMutationState<Result>>
>;

const noValue = Symbol("noValue");

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
  const unalteredValues = new Map<G["QueryHash"], unknown>();

  function watchMutation<Input, Data, Result>(
    ml: G["MutationLocator"],
    result: (input: Input) => (data: MutationState<Data>) => Result
  ): MutationWatch<Result> {
    return (
      impl.mutations$ as Observable<{
        isMatch: (ml: G["MutationLocator"]) => boolean;
        input: Input;
        data$: Observable<Data>;
      }>
    ).pipe(
      filter(({ isMatch }) => isMatch(ml)),
      map((value) => {
        const closure = result(value.input);
        return value.data$.pipe(
          map((data) => ({ status: "success" as const, data })),
          startWith({ status: "pending" as const, data: undefined }),
          map((result) => ({ status: result.status, result: closure(result) }))
        );
      })
    );
  }
  function postprocessQuery<Result, Data>(
    ql: G["QueryLocator"],
    mutationWatch: MutationWatch<Result>,
    transform: (
      value: Data,
      mutationState: Result,
      query: G["Query"]
    ) => Data | typeof stopInjection
  ) {
    mutationWatch.subscribe({
      next(mutation$) {
        let latestValue: InternalMutationState<Result> | typeof noValue =
          noValue;
        // TODO different token?
        const subscription = mutation$.subscribe({
          next(value) {
            latestValue = value;

            if (value.status === "pending") {
              impl.triggerRefetch([ql]);
            } else if (value.status === "success") {
              impl.updateCache([ql], <T>(data: T, hash: G["QueryHash"]) => {
                return transformer(
                  (unalteredValues.get(hash) as T | undefined) ?? data,
                  hash,
                  queryInjections.get(hash)
                );
              });
            }
          },
          error() {
            layer.unsubscribe();

            impl.triggerRefetch([ql]);
          }
        });
        const layer = queryInjections.addLayer({
          createItem: (q, lifecycle) => {
            if (impl.matchQuery(ql, q)) {
              return {
                item: {
                  transform: handleStopInjection<Data>(
                    (data) =>
                      latestValue === noValue
                        ? stopInjection
                        : transform(data, latestValue.result, q),
                    lifecycle.cleanupItem
                  ) as <T>(data: T) => T
                },
                onCleanupItem: () => subscription.unsubscribe()
                // TODO clean up layer after last item is cleaned up
              };
            } else {
              return noMatch;
            }
          }
        });
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
    return transformer(
      unaltered,
      queryHash,
      queryInjections.getOrCreate(queryHash, query)
    );
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
      onQueryCacheExpired
    }
  };
}

export type DefaultResult<Input, Data> = {
  input: Input;
} & MutationState<Data>;
export type DefaultResultC<Input, Data, Context> = DefaultResult<
  Input,
  Data
> & { context: Context };

// export function defaultResultState<Input, Data>(
//   input: Input
// ): (data: MutationState<Data>) => DefaultResult<Input, Data> {
//   return ({ status, data }) =>
//     ({ input, status, data }) as DefaultResult<Input, Data>;
// }

export type _WatchMutationResultFunc<Input, Data> =
  | undefined
  | ((input: Input) => object | ((data: MutationState<Data>) => any));
export type ResultOf<
  Input,
  Data,
  F extends _WatchMutationResultFunc<Input, Data>
> = F extends undefined
  ? { input: Input } & MutationState<Data>
  : F extends (input: Input) => infer Context
    ? Context extends object
      ? { input: Input; context: Context } & MutationState<Data>
      : Context extends (data: MutationState<Data>) => infer Result
        ? Result
        : never
    : never;

export function defaultResultState<
  Input,
  Data,
  F extends _WatchMutationResultFunc<Input, Data>
>(
  fn: F
): (input: Input) => (data: MutationState<Data>) => ResultOf<Input, Data, F> {
  return (input: Input) => {
    const context =
      fn?.(input) ?? (({ data, status }) => ({ input, data, status }));
    return context instanceof Function
      ? (context as Exclude<typeof context, object>)
      : ({ data, status }: MutationState<Data>) =>
          ({
            data,
            status,
            context,
            input
          }) as ResultOf<Input, Data, F>;
  };
}
