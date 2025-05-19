import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import {
  createTRPCOptionsProxy,
  TRPCQueryKey
} from "@trpc/tanstack-react-query";
import type { AppRouter } from "../../../server";
import { QueryClient, QueryObserverOptions } from "@tanstack/react-query";
import { optimisticUpdatesViaTanstackDecoration } from "../optimistic-updates";

export const queryClient = new QueryClient();

// export const queryClient = optimisticUpdatesViaTanstackDecoration(
//   new InjectableQueryClient({
//     defaultOptions: {
//       queries: {
//         // ...
//       },
//     },
//   })
// );

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    // ...optimisticUpdatesViaLink(queryClient),
    loggerLink(),
    httpBatchLink({ url: "http://localhost:3033" })
  ]
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient
});

export const wrapOptions = optimisticUpdatesViaTanstackDecoration(
  queryClient,
  trpc
) as <
  T,
  Opts extends QueryObserverOptions<T, any, any, any, TRPCQueryKey, any>
>(
  options: Opts
) => Opts;
