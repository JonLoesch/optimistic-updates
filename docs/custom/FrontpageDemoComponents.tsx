import { FC, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  addToServerState,
  fetchServerState,
  optimisticUpdatesEnabled,
  triggerMutationToQueryAnimation,
  useOptimisticQuery,
} from "./FrontpageDemo";
import { OptimisticUpdateEngineReactQuery, stopInjection, type MutationState } from "@optimistic-updates/react-query";

export const AddItem: FC = () => {
  const [state, setState] = useState("");
  const mutation = useMutation({
    mutationKey: ["addTodo"],
    mutationFn: addToServerState,
  });

  // This is a silly behaviour but in the demo we don't so much care what the actual data being added is,
  // so we have some silly sample data so the user can just repeated click the add button and see things happen:
  const [placeholder, setPlaceholder] = useState(sampleAdditions[0]);

  return (
    <div className="flex flex-col items-end gap-2">
      <input value={state} placeholder={placeholder} onChange={(e) => setState(e.target.value)} className="input" />
      <button
        onClick={() => {
          void mutation.mutate(state === "" ? placeholder : state);
          setPlaceholder(nextSample());
          setState("");
        }}
        // className="p-1.5 cursor-pointer bg-[#ecf4fb] text-[#0075bf] hover:text-[#cfe4f4] hover:bg-[#006aae]"
        className="btn btn-soft btn-primary"
      >
        Click here to try it out!
      </button>
    </div>
  );
};

export const DisplayItems: FC = () => {
  const items = useOptimisticQuery({
    queryKey: ["getTodos"],
    queryFn: fetchServerState,
  });
  return items.isSuccess ? (
    <div className="text-left">
      <ul className="list-disc list-inside">
        {items.data.map((x) => (
          <li key={x.id}>{x.label}</li>
        ))}
      </ul>
      <hr />
      <pre className="overflow-scroll">
        {"[\n  "}
        {items.data.map((x) => JSON.stringify(x)).join(",\n  ")}
        {",\n]"}
      </pre>
    </div>
  ) : (
    "... loading"
  );
};

export function optimisticUpdateLogic(engine: OptimisticUpdateEngineReactQuery) {
  let autoDec = -1;
  engine.inject({
    from: { mutationKey: ["addTodo"] },
    into: { queryKey: ["getTodos"] },
    context: () => autoDec--,
    transform(
      value: Awaited<ReturnType<typeof fetchServerState>>,
      mutationState: { input: string; context: number } & MutationState<number>
    ) {
      if (!optimisticUpdatesEnabled()) return stopInjection;
      if (value.find((x) => x.id === mutationState.data)) return stopInjection;
      triggerMutationToQueryAnimation(); // only for purposes of demo (animating the connection for the data flow)
      return [
        ...value,
        {
          label: mutationState.input,
          id: mutationState.status === "success" ? mutationState.data : mutationState.context,
          optimistic: true,
        },
      ];
    },
  });
}

const sampleAdditions = [
  "Add Features",
  "Introduce accidental bugs",
  "Headscratching",
  "Take a break",
  "Shower epiphany",
  "Bugfix",
  "More customer requests",
  "Repeat",
];
let inc = 1;
function nextSample() {
  return sampleAdditions[inc++ % sampleAdditions.length];
}
