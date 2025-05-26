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
  type Subscribable,
} from "rxjs";
import { CacheLayer, LayeredQueryCache, noMatch } from "./layeredQueryCache";
import { assertUnreachable } from "./assertUnreachable";
import { Engine, InjectionParameters } from "./signatureBoilerplate";

export const stopInjection = Symbol("stopInjection");
export type OptimisticUpdateGenericParameters = {
  Query: unknown;
  QueryLocator: unknown;
  QueryHash: PropertyKey;
  MutationLocator: unknown;
};
export type ImplementationParameters<G extends OptimisticUpdateGenericParameters> = {
  hashQuery: (q: G["Query"]) => G["QueryHash"];
  queryInput: (q: G["Query"]) => unknown;
  matchQuery: (ql: G["QueryLocator"], q: G["Query"]) => boolean;
  updateCache: (ql: G["QueryLocator"], updater: <T>(data: T, qh: G["Query"]) => T) => void;
  triggerRefetch: (ql: G["QueryLocator"]) => void;
  mutations$: Observable<{
    input: unknown;
    isMatch: (ml: G["MutationLocator"]) => boolean;
    data$: Observable<unknown>;
  }>;
  queryCacheExpirations$: Observable<G["QueryHash"]>;
};

export type AnyDef = SpecificDef<unknown, unknown, unknown, unknown, unknown, unknown>;
export type SpecificDef<TSourceInput, TSourceError, TSourceOutput, TTargetInput, TTargetError, TTargetOutput> = {
  source: {
    input: TSourceInput;
    error: TSourceError;
    output: TSourceOutput;
  };
  target: {
    input: TTargetInput;
    error: TTargetError;
    output: TTargetOutput;
  };
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

export type MutationWatch<Result> = Subscribable<Observable<InternalMutationState<Result>>>;

export type InferWatchedType<W extends MutationWatch<unknown>> = W extends MutationWatch<infer X> ? X : never;

export function optimisticEngineCore<G extends OptimisticUpdateGenericParameters>(impl: ImplementationParameters<G>) {
  const queryInjections = new LayeredQueryCache<G, <T>(data: T) => T | typeof stopInjection>();
  const unalteredValues = new Map<G["QueryHash"], unknown>();
  const onMutation = new Subject<ObservedValueOf<typeof impl.mutations$>>();
  impl.mutations$.subscribe(onMutation);
  impl.mutations$.pipe(mergeMap((x) => x.data$.pipe(catchError(() => of())))).subscribe({
    next() {
      // Do this after every mutation state change
      queryInjections.gc();
    },
  });
  impl.queryCacheExpirations$.subscribe((qh) => queryInjections.delete(qh));

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  function _watchMutation<Input, Data, Result>(
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
          map((result) => ({
            status: result.status,
            result: closure(result),
          }))
        );
      })
    );
  }
  function postprocessQuery<Data, Result, QueryInput>(
    ql: G["QueryLocator"],
    mutationWatch: MutationWatch<Result>,
    transform: (value: Data, mutationState: Result, queryInput: QueryInput) => Data | typeof stopInjection
  ) {
    mutationWatch.subscribe({
      next(mutation$) {
        let latestValue: InternalMutationState<Result> | { status: "error" | "pending" } = {
          status: "pending",
        };
        queryInjections.add(
          () =>
            new CacheLayer({
              create: (q) => {
                if (impl.matchQuery(ql, q)) {
                  return generic((data: Data) =>
                    "result" in latestValue
                      ? transform(data, latestValue.result, impl.queryInput(q) as QueryInput)
                      : latestValue.status === "error"
                        ? stopInjection
                        : data
                  );
                } else {
                  return noMatch;
                }
              },
              canGC: () => latestValue.status !== "pending",
            })
        );
        mutation$.pipe(catchError(() => of({ status: "error" as const }))).subscribe({
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
          },
        });
      },
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
    return transformer(unaltered, queryHash, queryInjections.getOrCreate(queryHash, query));
  }

  return {
    engine: {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
      watchMutation<Input, Output, Result>(
        ml: G["MutationLocator"],
        onMutationInput?: (input: unknown) => object | ((data: MutationState<unknown>) => unknown)
      ) {
        return _watchMutation<Input, Output, Result>(ml, (input) => {
          const value = onMutationInput?.(input);
          return value instanceof Function
            ? (value as (o: MutationState<Output>) => Result)
            : (state) =>
                ({
                  input,
                  context: value,
                  ...state,
                }) as Result;
        });
      },

      // postprocessQuery,
      inject(params: InjectionParameters<AnyDef, unknown, unknown>) {
        if ("watch" in params) {
          postprocessQuery(params.to, params.watch, params.transform);
        } else if ("context" in params) {
          postprocessQuery(params.to, this.watchMutation(params.from, params.context), params.transform);
        } else {
          postprocessQuery(params.to, this.watchMutation(params.from), params.transform);
        }
      },
    } satisfies Engine,
    hooks: {
      wrapValue,
    },
  };
}
