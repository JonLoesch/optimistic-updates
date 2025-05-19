import { QueryClient } from "@tanstack/react-query";
import { AppRouter } from "../../server";
import {
  optimisticTRPCClient,
  stopInjection
} from "./tanstack-query-optimistic";
import { optimisticTanstackQuery } from "@optimistic-updates/tanstack-query";
import { TRPCClient } from "@trpc/client";
import { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

export function optimisticUpdatesViaTanstackDecoration(
  baseClient: QueryClient,
  trpc: TRPCOptionsProxy<AppRouter>
) {
  const opt = optimisticTanstackQuery(baseClient);
  opt.add(
    trpc.threads.all.queryKey(),
    {
      additions: { mutationKey: trpc.threads.create.mutationKey() },
      deletions: { mutationKey: trpc.threads.delete.mutationKey() }
    },
    (value, mutations) => {
      console.log(value, { mutations });
      return value;
    }
  );
  opt.add(
    trpc.posts.allInThread.queryKey(),
    {
      additions: { mutationKey: trpc.posts.create.mutationKey() },
      deletions: { mutationKey: trpc.posts.delete.mutationKey() }
    },
    (value, mutations) => {
      return value;
    }
  );

  return opt.wrapOptions;

  // return optimisticTRPCClient<AppRouter>((builder, trpc) => {
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
