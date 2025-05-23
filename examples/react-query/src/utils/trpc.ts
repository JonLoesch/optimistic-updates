import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { AppRouter } from "../../../server";
import { QueryClient } from "@tanstack/react-query";
import { addOptimisticUpdates } from "../optimistic-updates";
import { createOptimisticTanstackQueryModel } from "@optimistic-updates/tanstack-query";

export const queryClient = new QueryClient();
addOptimisticUpdates(createOptimisticTanstackQueryModel(queryClient).model);

const trpcClient = createTRPCClient<AppRouter>({
  links: [loggerLink(), httpBatchLink({ url: "http://localhost:3033" })]
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient
});
