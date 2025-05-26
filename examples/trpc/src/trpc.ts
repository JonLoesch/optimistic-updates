import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { AppRouter } from "../../server";
import { QueryClient } from "@tanstack/react-query";
import { addOptimisticUpdates } from "./optimistic-updates";
import { optimisticEngineTRPC } from "@optimistic-updates/trpc";

export const queryClient = new QueryClient();

const { engine, link } = optimisticEngineTRPC(queryClient);

const trpcClient = createTRPCClient<AppRouter>({
  links: [link, loggerLink(), httpBatchLink({ url: "http://localhost:3033" })],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});

addOptimisticUpdates(engine, trpc);
