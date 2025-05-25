import { AppRouter } from "../../server";
import { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import {
  OptimisticUpdateTRPCModel,
  stopInjection
} from "@optimistic-updates/trpc";

export function addOptimisticUpdates(
  model: OptimisticUpdateTRPCModel,
  trpc: TRPCOptionsProxy<AppRouter>
) {
  let autoDec = -1;
  const additions = model.watchMutation(trpc.threads.create, () => ({
    fakeId: autoDec--
  }));
  model.postprocessQuery(
    trpc.threads.all,
    additions,
    (value, mutationState) => {
      // console.log({ value, mutationState });
      if (
        mutationState.status === "success" &&
        value.find((x) => x.id === mutationState.data.id)
      ) {
        console.log("stopInjection");
        return stopInjection;
      }
      return [
        ...value,
        { ...mutationState.input, id: mutationState.context.fakeId }
      ];
    }
  );
  model.postprocessQuery(
    trpc.threads.all,
    model.watchMutation(trpc.threads.delete, undefined),
    (value, mutationState) => {
      console.log({ value, mutationState });
      if (!value.find((x) => x.id === mutationState.input.id)) {
        return stopInjection;
      }
      return value.filter((x) => x.id !== mutationState.input.id);
    }
  );
}
