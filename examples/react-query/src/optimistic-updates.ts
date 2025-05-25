import {
  OptimisticUpdateTanstackQueryModel,
  stopInjection,
  type InferWatchedType
} from "@optimistic-updates/tanstack-query";
import { trpc } from "./utils/trpc";

export function addOptimisticUpdates(
  model: OptimisticUpdateTanstackQueryModel
) {
  let autoDec = -1;
  const makeFakeId = () => ({
    fakeId: autoDec--
  });
  const additions = model.watchMutation<
    { title: string },
    { id: number },
    typeof makeFakeId
  >(
    {
      mutationKey: trpc.threads.create.mutationKey()
    },
    makeFakeId
  );
  model.postprocessQuery<
    { id: number; title: string }[],
    InferWatchedType<typeof additions>
  >(
    { queryKey: trpc.threads.all.queryKey() },
    additions,
    (value, mutationState) => {
      if (
        mutationState.status === "success" &&
        value.find((x) => x.id === mutationState.data.id)
      ) {
        return stopInjection;
      }
      return [
        ...value,
        { ...mutationState.input, id: mutationState.context.fakeId }
      ];
    }
  );
  const deletions = model.watchMutation<{ id: number }, "success", undefined>(
    {
      mutationKey: trpc.threads.delete.mutationKey()
    },
    undefined
  );
  model.postprocessQuery<
    { id: number; title: string }[],
    InferWatchedType<typeof deletions>
  >(
    { queryKey: trpc.threads.all.queryKey() },
    deletions,
    (value, mutationState) => {
      if (!value.find((x) => x.id === mutationState.input.id)) {
        return stopInjection;
      }
      return value.filter((x) => x.id !== mutationState.input.id);
    }
  );
  //   let autoDec = -1;
  //   builder.optimisticArrayInsert(
  //     {
  //       from: trpc.threads.create,
  //       to: trpc.threads.all
  //     },
  //     {
  //       fakeValue: (input) => ({ ...input, id: autoDec-- }),
  //       matchValue(input, fromServer, mutationResult) {
  //         if (mutationResult?.id === fromServer.id) return "exact";
  //         if (input.title === fromServer.title) return "fuzzy";
  //       }
  //     }
  //   );

  //   builder.optimisticArrayRemove(
  //     {
  //       from: trpc.threads.delete,
  //       to: trpc.threads.all
  //     },
  //     {
  //       matchValue(input, fromServer) {
  //         return input.id == fromServer.id;
  //       }
  //     }
  //   );

  //   builder.optimisticArrayInsert(
  //     {
  //       from: trpc.posts.create,
  //       to: trpc.posts.allInThread
  //     },
  //     {
  //       queryParameters(mutationParameters) {
  //         return { threadId: mutationParameters.threadId };
  //       },
  //       fakeValue: (input) => ({ ...input, id: autoDec-- }),
  //       matchValue(input, fromServer, mutationResult) {
  //         if (mutationResult?.id === fromServer.id) return "exact";
  //         if (input.content === fromServer.content) return "fuzzy";
  //       }
  //     }
  //   );

  //   builder.optimisticArrayRemove(
  //     {
  //       from: trpc.posts.delete,
  //       to: trpc.posts.allInThread
  //     },
  //     {
  //       matchValue: (input, fromServer) => input.id === fromServer.id
  //     }
  //   );

  //   // builder.untyped.optimisticArrayRemove({
  //   //   from: { mutationKey: [["posts", "delete"]] },
  //   //   to: {
  //   //     static: { queryKey: [["posts", "allInThread"]] },
  //   //     dynamic: (mutationState) => ({
  //   //       queryKey: [
  //   //         ["posts", "allInThread"],
  //   //         { threadId: mutationState.variables.threadId },
  //   //       ],
  //   //     }),
  //   //   },
  //   //   matchValue: (input, fromServer) => input.id === fromServer.id,
  //   // });
  // }, baseClient);
}
