/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * This is the API-handler of your app that contains all your API routes.
 * On a bigger app, you will probably want to split this file up into multiple files.
 */
import { initTRPC } from "@trpc/server";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { z } from "zod";

const t = initTRPC.create();

/**
 * Middleware for adding an artificial delay.  (3s-5s)
 */
const timingMiddleware = t.middleware(async ({ next }) => {
  const waitMs = Math.floor(Math.random() * 2000) + 3000;
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  return await next();
});

const publicProcedure = t.procedure.use(timingMiddleware);
const router = t.router;

/* Quick-and-dirty sample TRPC router with some fake data: */
const fakeData = new Map<
  number,
  {
    title: string;
    posts: Map<
      number,
      {
        content: string;
      }
    >;
  }
>();
let autoInc = 1;

const appRouter = router({
  threads: router({
    all: publicProcedure.query(() =>
      Array.from(fakeData).map(([id, { posts, ...rest }]) => ({
        id,
        ...rest,
      }))
    ),
    create: publicProcedure.input(z.object({ title: z.string() })).mutation(({ input }) => {
      const id = autoInc++;
      fakeData.set(id, { ...input, posts: new Map() });
      return { id };
    }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => {
      if (!fakeData.delete(input.id)) throw new Error();
      return "success";
    }),
  }),
  posts: router({
    allInThread: publicProcedure.input(z.object({ threadId: z.number() })).query(({ input }) =>
      Array.from(fakeData.get(input.threadId)!.posts).map(([id, post]) => ({
        id,
        ...post,
      }))
    ),
    create: publicProcedure.input(z.object({ threadId: z.number(), content: z.string() })).mutation(({ input }) => {
      const id = autoInc++;
      const { threadId, ...rest } = input;
      fakeData.get(threadId)!.posts.set(id, { ...rest });
      return { id };
    }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => {
      for (const thread of fakeData.values()) {
        thread.posts.delete(input.id);
      }
      return "success";
    }),
  }),
});

// export only the type definition of the API
// None of the actual implementation is exposed to the client
export type AppRouter = typeof appRouter;

// create server
createHTTPServer({
  middleware: cors(),
  router: appRouter,
  createContext() {
    return {};
  },
}).listen(3033);
