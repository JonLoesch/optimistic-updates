import { type OptimisticUpdateEngineTanstackQuery, stopInjection } from "@optimistic-updates/tanstack-query";

export function addOptimisticUpdates(engine: OptimisticUpdateEngineTanstackQuery) {
  let autoDec = -1;
  const additions = engine.watch<{ title: string }, { id: number }, { fakeId: number }>(
    { mutationKey: ["threads", "create"] },
    () => ({ fakeId: autoDec-- })
  );

  engine.inject({
    watch: additions,
    into: { queryKey: ["threads", "all"] },

    transform: (value: { id: number; title: string }[], mutationState) => {
      if (mutationState.status === "success" && value.find((x) => x.id === mutationState.data.id)) {
        return stopInjection;
      }
      return [...value, { ...mutationState.input, id: mutationState.context.fakeId }];
    },
  });
  engine.inject({
    from: { mutationKey: ["threads", "delete"] },
    into: { queryKey: ["threads", "all"] },
    transform: (value: { id: number; title: string }[], mutationState: { input: { id: number } }) => {
      if (!value.find((x) => x.id === mutationState.input.id)) {
        return stopInjection;
      }
      return value.filter((x) => x.id !== mutationState.input.id);
    },
  });

  engine.inject({
    from: { mutationKey: ["posts", "create"] },
    into: { queryKey: ["posts", "allInThread"] },
    context: (input: { content: string; threadId: number }) => ({ ...input, id: autoDec-- }),
    transform: (
      value: { id: number; content: string }[],
      mutationState,
      queryInput: ["posts", "allInThread", number]
    ) => {
      if (queryInput[2] !== mutationState.input.threadId) return stopInjection;
      if (mutationState.status === "success" && value.find((x) => x.id === (mutationState.data as { id: number }).id))
        return stopInjection;
      if (value.find((x) => x.content === mutationState.input.content)) return value;
      return [...value, mutationState.context];
    },
  });

  engine.inject({
    from: { mutationKey: ["posts", "delete"] },
    into: { queryKey: ["posts", "allInThread"] },
    transform: (value: { id: number; content: string }[], mutationState: { input: { id: number } }) => {
      if (!value.find((x) => x.id === mutationState.input.id)) {
        return stopInjection;
      }
      return value.filter((x) => x.id !== mutationState.input.id);
    },
  });
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
