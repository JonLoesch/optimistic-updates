import { AppRouter } from "../../server";
import { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { OptimisticUpdateTRPCModel, stopInjection } from "@optimistic-updates/trpc";

let autoDec = -1; // make all optimistic IDs negative so we can tell them apart from real IDs at a glance

export function addOptimisticUpdates(engine: OptimisticUpdateTRPCModel, trpc: TRPCOptionsProxy<AppRouter>) {
  engine.inject({
    from: trpc.threads.create,
    context(input) {
      return {
        ...input,
        id: autoDec--,
      };
    },
    to: trpc.threads.all,
    transform(value, mutationState) {
      if (mutationState.status === "success" && value.find((x) => x.id === mutationState.data.id)) {
        return stopInjection;
      }
      return [...value, mutationState.context];
    },
  });
  engine.inject({
    from: trpc.threads.delete,
    to: trpc.threads.all,
    transform(value, mutationState) {
      if (!value.find((x) => x.id === mutationState.input.id)) {
        return stopInjection;
      }
      return value.filter((x) => x.id !== mutationState.input.id);
    },
  });
}
