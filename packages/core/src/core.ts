import {
  catchError,
  filter,
  map,
  mergeMap,
  Observable,
  of,
  startWith,
  Subject,
  type ObservedValueOf,
  type Subscribable
} from "rxjs";
import type { OptimisticUpdateGenericParameters } from "./types";
import { CacheLayer, LayeredQueryCache, noMatch } from "./layeredQueryCache";
import { assertUnreachable } from "./assertUnreachable";

export const stopInjection = Symbol("stopInjection");

export type ImplementationParameters<
  G extends OptimisticUpdateGenericParameters
> = {
  hashQuery: (q: G["Query"]) => G["QueryHash"];
  matchQuery: (ql: G["QueryLocator"], q: G["Query"]) => boolean;
  updateCache: (
    ql: G["QueryLocator"],
    updater: <T>(data: T, qh: G["Query"]) => T
  ) => void;
  triggerRefetch: (ql: G["QueryLocator"]) => void;
  mutations$: Observable<{
    input: unknown;
    isMatch: (ml: G["MutationLocator"]) => boolean;
    data$: Observable<unknown>;
  }>;
};

function generic<Data>(fn: (x: Data) => Data | typeof stopInjection) {
  return fn as <T>(x: T) => T | typeof stopInjection;
}

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
  Observable<InternalMutationState<Result>>
>;

export type InferWatchedType<W extends MutationWatch<unknown>> =
  W extends MutationWatch<infer X> ? X : never;

export function createAbstractOptimisticModel<
  G extends OptimisticUpdateGenericParameters
>(impl: ImplementationParameters<G>) {
  const queryInjections = new LayeredQueryCache<
    G,
    <T>(data: T) => T | typeof stopInjection
  >();
  const unalteredValues = new Map<G["QueryHash"], unknown>();
  const onMutation = new Subject<ObservedValueOf<typeof impl.mutations$>>();
  impl.mutations$.subscribe(onMutation);
  impl.mutations$
    .pipe(mergeMap((x) => x.data$.pipe(catchError(() => of()))))
    .subscribe({
      next() {
        // Do this after every mutation state change
        queryInjections.gc();
      }
    });

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  function watchMutation<Input, Data, Result>(
    ml: G["MutationLocator"],
    result: (input: Input) => (data: MutationState<Data>) => Result
  ): MutationWatch<Result> {
    return (
      onMutation as Observable<{
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
  function postprocessQuery<Data, Result>(
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
        let latestValue:
          | InternalMutationState<Result>
          | { status: "error" | "pending" } = { status: "pending" };
        queryInjections.add(
          () =>
            new CacheLayer({
              create: (q) => {
                if (impl.matchQuery(ql, q)) {
                  return generic((data: Data) =>
                    "result" in latestValue
                      ? transform(data, latestValue.result, q)
                      : latestValue.status === "error"
                        ? stopInjection
                        : data
                  );
                } else {
                  return noMatch;
                }
              },
              canGC: () => latestValue.status !== "pending"
            })
        );
        mutation$
          .pipe(catchError(() => of({ status: "error" as const })))
          .subscribe({
            next(value) {
              latestValue = value;

              if (value.status === "pending" || value.status === "error") {
                impl.updateCache(ql, <T>(data: T, query: G["Query"]) => {
                  const hash = impl.hashQuery(query);
                  return transformer(
                    (unalteredValues.get(hash) as T | undefined) ?? data,
                    hash,
                    queryInjections.getOrCreate(hash, query)
                  );
                });
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              } else if (value.status === "success") {
                impl.triggerRefetch(ql);
              } else {
                assertUnreachable(value.status);
              }
            }
          });
      }
    });
  }
  function transformer<Data>(
    unaltered: Data,
    qh: G["QueryHash"],
    injections: ReturnType<typeof queryInjections.getOrCreate>
  ): Data {
    let isAltered = false;
    let value = unaltered;

    for (const [transform, s] of injections) {
      const newValue = transform(value);
      if (newValue === stopInjection) {
        s.unsubscribe();
        continue;
      }
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
    queryInjections.delete(qh);
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
  | ((input: Input) => object | ((data: MutationState<Data>) => unknown));
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
