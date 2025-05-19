import {
  matchMutation,
  Mutation,
  MutationKey,
  MutationObserverResult,
  Query,
  QueryClient,
  QueryFunction,
  QueryFunctionContext,
  QueryKey
} from "@tanstack/query-core";
import { DynamicHandlers, getOrCreate, InjectionPrimitives } from "./decorate";

class InjectionModel<
  QL,
  Q,
  QLH extends keyof any,
  QH extends keyof any,
  ML,
  M,
  MLH extends keyof any,
  MH extends keyof any,
  Data = any
> {
  hashQuery(q: Q): QH {
    return undefined as any;
  }
  hashMutation(q: M): MH {
    return undefined as any;
  }
  hashQueryLocator(q: QL): QLH {
    return undefined as any;
  }
  hashMutationLocator(q: ML): MLH {
    return undefined as any;
  }

  refreshMap = new Map<MLH, QL[]>();
  query;
  add(
    query: QL,
    mutations: Record<string, ML>,
    processor: (value: Data, context: Q, mutations: Record<string, M[]>) => Data
  ) {
    for (const ml of Object.values(mutations)) {
      getOrCreate(this.refreshMap, this.hashMutationLocator(ml), () => []).push(
        query
      );
    }
  }

  attach(impl: {
    matchQuery: (l: QL, q: Q) => boolean;
    matchMutation: (l: ML, m: M) => boolean;
    refreshQueries: (l: ML) => void;
  }): {
    onMutation: (m: M) => void;
    wrapValue: (value: Data, context: Q) => Data;
  } {
    const self = this;
    return {
      wrapValue(value, context) {
        for (const x of self.activeFilters.active(context)) {
        }
        return value;
      },
      onMutation(m) {}
    };
  }
}

type TQInjection = InjectionModel<
  QueryKey,
  QueryKey,
  string,
  MutationKey,
  MutationObserverResult & {
    mutation: Mutation;
  },
  number
>;

function attach(injection: TQInjection, queryClient: QueryClient) {
  const x = injection.attach({
    hashMutation: (m) => m.mutation.mutationId,
    hashQuery(q) {
      return q
        .flat()
        .map((x) => `${x}`)
        .join(".");
    },
    matchQuery(l, q) {
      return this.hashQuery(q).startsWith(this.hashQuery(l));
    },
    matchMutation(l, m) {
      return matchMutation({ mutationKey: l }, m.mutation);
    }
  });

  queryClient.getMutationCache().subscribe((event) => {
    if (event.type === "updated") {
      const result = {
        ...event.mutation.state,
        isPending: event.mutation.state.status === "pending",
        isSuccess: event.mutation.state.status === "success",
        isError: event.mutation.state.status === "error",
        isIdle: event.mutation.state.status === "idle"
      } as MutationObserverResult;
      x.onMutation({ ...result, mutation: event.mutation });
    }
  });
}
