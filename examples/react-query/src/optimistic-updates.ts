import { DefaultError, QueryClient } from "@tanstack/react-query";
import {
  OptimisticUpdateTanstackQueryModel,
  stopInjection
} from "@optimistic-updates/tanstack-query";
import { trpc } from "./utils/trpc";

export function addOptimisticUpdates(
  model: OptimisticUpdateTanstackQueryModel
) {
  let autoDec = -1;
  const m = {
    additions: model.watchMutation<
      { id: number },
      DefaultError,
      { title: string },
      { id: number }
    >(
      {
        mutationKey: trpc.threads.create.mutationKey()
      },
      (m) => ({ id: autoDec-- })
    ),
    deletions: model.watchMutation<undefined, DefaultError, { id: number }>({
      mutationKey: trpc.threads.delete.mutationKey()
    })
  };
  model.postprocessQuery<typeof m, { id: number; title: string }[]>(
    { queryKey: trpc.threads.all.queryKey() },
    m,
    (value, mutationState) => {
      console.log("optimistic", value, mutationState);
      if (
        mutationState.additions.every(
          (m) => m.status === "success" && value.find((x) => x.id === m.data.id)
        ) &&
        mutationState.deletions.every(
          // TODO fix this non-null assertion
          (m) => !value.find((x) => x.id === m.variables!.id)
        )
      ) {
        return stopInjection;
      }
      return [
        ...value,
        ...mutationState.additions.map((m) => ({
          // TODO fix this non-null assertion
          ...m.variables!,
          id: m.id
        }))
      ].filter(
        // TODO fix this non-null assertion
        (x) => !mutationState.deletions.some((d) => d.variables!.id === x.id)
      );
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
