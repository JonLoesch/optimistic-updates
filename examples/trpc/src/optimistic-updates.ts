import { AppRouter } from "../../server";
import { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { OptimisticUpdateTRPCModel } from "@optimistic-updates/trpc";
import { stopInjection } from "../../../packages/core/dist/injectionModel";

export function addOptimisticUpdates(
  model: OptimisticUpdateTRPCModel,
  trpc: TRPCOptionsProxy<AppRouter>
) {
  let autoDec = -1;
  model.postprocessQuery(
    trpc.threads.all,
    {
      additions: model.watchMutation(trpc.threads.create, () => ({
        id: autoDec--
      })),
      deletions: model.watchMutation(trpc.threads.delete)
    },
    (value, mutationState) => {
      console.log("optimistic", value, mutationState);
      if (
        mutationState.additions.every(
          (m) =>
            m.status === "success" && value.find((x) => x.id === m.result?.id)
        ) &&
        mutationState.deletions.every(
          (m) => !value.find((x) => x.id === m.input.id)
        )
      ) {
        return stopInjection;
      }
      return [
        ...value,
        ...mutationState.additions.map((m) => ({
          ...m.input,
          id: m.id
        }))
      ].filter(
        (x) => !mutationState.deletions.some((d) => d.input.id === x.id)
      );
    }
  );
}
