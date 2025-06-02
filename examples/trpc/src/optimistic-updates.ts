import { AppRouter } from "../../server";
import { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { type OptimisticUpdateEngineTRPC, stopInjection } from "@optimistic-updates/trpc";

let autoDec = -1; // make all optimistic IDs negative so we can tell them apart from real IDs at a glance

// Below is all the code required to make 4 mutations and 2 queries fully optimistic.
// This acts as a transparent layer -- the sample App code (in App.tsx) is very dumb and has no knowledge of this,
// but the App still recieves updates and refetches as necessary

export function addOptimisticUpdates(engine: OptimisticUpdateEngineTRPC, trpc: TRPCOptionsProxy<AppRouter>) {
  engine.inject({
    from: trpc.threads.create,
    context(input) {
      return {
        ...input,
        id: autoDec--,
      };
    },
    into: trpc.threads.all,
    transform(value, mutationState) {
      if (mutationState.status === "success" && value.find((x) => x.id === mutationState.data.id)) {
        return stopInjection;
      }
      return [...value, mutationState.context];
    },
  });
  engine.inject({
    from: trpc.threads.delete,
    into: trpc.threads.all,
    transform(value, mutationState) {
      if (!value.find((x) => x.id === mutationState.input.id)) {
        return stopInjection;
      }
      return value.filter((x) => x.id !== mutationState.input.id);
    },
  });

  engine.inject({
    from: trpc.posts.create,
    context: (input) => ({ ...input, id: autoDec-- }),
    into: trpc.posts.allInThread,
    transform(value, mutationState, queryInput) {
      console.log({ value, mutationState, queryInput });
      if (queryInput.threadId !== mutationState.input.threadId) return stopInjection;
      if (mutationState.status === "success" && value.find((x) => x.id === mutationState.data.id)) return stopInjection;
      if (value.find((x) => x.content === mutationState.input.content)) return value;
      return [...value, mutationState.context];
    },
  });

  engine.inject({
    from: trpc.posts.delete,
    into: trpc.posts.allInThread,
    transform(value, mutationState) {
      if (!value.find((x) => x.id === mutationState.input.id)) {
        return stopInjection;
      }
      return value.filter((x) => x.id !== mutationState.input.id);
    },
  });
}
