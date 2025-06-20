import { QueryClientProvider, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useReducer, useState } from "react";
import { get, post, queryClient, useQuery } from "./api";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AllThreads />
      <ActiveRequests />
    </QueryClientProvider>
  );
}

function AllThreads() {
  const threads = useQuery({
    queryKey: ["threads", "all"],
    queryFn: () => get("threads.all") as Promise<{ id: number; title: string }[]>,
  });
  return (
    <>
      <div>{threads.isSuccess && threads.data.map((thread) => <Thread thread={thread} key={thread.id} />)}</div>
      <NewThread />
    </>
  );
}

function NewThread() {
  const [title, setTitle] = useState("");
  const addThread = useMutation({
    mutationKey: ["threads", "create"],
    mutationFn: (variables: { title: string }) => post("threads.create", variables),
  });

  return (
    <div>
      new thread title:
      <TextInput text={title} setText={setTitle} />
      <input
        type="button"
        value="Create new Thread"
        onClick={() => {
          addThread.mutate({ title });
          setTitle("");
        }}
      />
    </div>
  );
}

function Thread(props: { thread: { title: string; id: number } }) {
  const deleteThread = useMutation({
    mutationKey: ["threads", "delete"],
    mutationFn: (variables: { id: number }) => post("threads.delete", variables),
  });

  return (
    <div className="thread">
      Thread: {props.thread.title}
      <input type="button" value="Delete this Thread" onClick={() => deleteThread.mutate({ id: props.thread.id })} />
      <AllPosts threadId={props.thread.id} />
    </div>
  );
}

function AllPosts(props: { threadId: number }) {
  const posts = useQuery({
    queryKey: ["posts", "allInThread", props.threadId],
    queryFn: () => get("posts.allInThread", { threadId: props.threadId }) as Promise<{ content: string; id: number }[]>,
  });
  return (
    <>
      <div>{posts.isSuccess && posts.data.map((p) => <Post post={p} key={p.id} threadId={props.threadId} />)}</div>
      <NewPost threadId={props.threadId} />
    </>
  );
}
function Post(props: { post: { id: number; content: string }; threadId: number }) {
  const deletePost = useMutation({
    mutationKey: ["posts", "delete"],
    mutationFn: (variables: { id: number }) => post("posts.delete", variables),
  });

  return (
    <div>
      Post: {props.post.content}
      <input type="button" value="Delete this Post" onClick={() => deletePost.mutate({ id: props.post.id })} />
    </div>
  );
}
function NewPost(props: { threadId: number }) {
  const [content, setContent] = useState("");
  const addPost = useMutation({
    mutationKey: ["posts", "create"],
    mutationFn: (variables: { content: string; threadId: number }) => post("posts.create", variables),
  });

  return (
    <>
      new post:
      <TextInput text={content} setText={setContent} />
      <input
        type="button"
        value="Create new Post"
        onClick={() => {
          addPost.mutate({ content, threadId: props.threadId });
          setContent("");
        }}
      />
    </>
  );
}

function TextInput(props: { text: string; setText: (text: string) => void }) {
  return <input type="text" onChange={(e) => props.setText(e.currentTarget.value)} value={props.text} />;
}

function ActiveRequests() {
  const queryClient = useQueryClient();

  const [activeQueriesInCache, updateQ] = useReducer(() => queryClient.getQueryCache().findAll(), []);
  const [activeMutationsInCache, updateM] = useReducer(() => queryClient.getMutationCache().getAll(), []);
  useEffect(() => queryClient.getQueryCache().subscribe(updateQ), [queryClient]);
  useEffect(() => queryClient.getMutationCache().subscribe(updateM), [queryClient]);
  const [_, poll] = useReducer<number, []>((n) => n + 1, 0);
  useEffect(() => () => clearInterval(setInterval(poll, 200)), []); // hacky way of bouncing the component to get the latest query data.  A terrible approach but this is not the point of this demo.

  return (
    <div>
      <hr />
      There's an artificial random 3-5 second delay implemented on the server for this demo. The optimistic updates
      should still make the feedback of CRUD operations snappy. You can see the current status of all queries and
      mutations below:
      <hr />
      {activeQueriesInCache.map((q) => (
        <pre key={q.queryHash}>
          Query: {q.queryHash} - {q.state.status} - {q.state.fetchStatus}
        </pre>
      ))}
      {activeMutationsInCache.map((m) => (
        <pre key={m.mutationId}>
          Mutation: {JSON.stringify([m.options.mutationKey])},{JSON.stringify(m.state.variables)} - {m.state.status}
        </pre>
      ))}
    </div>
  );
}
