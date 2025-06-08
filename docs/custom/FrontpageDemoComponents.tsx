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

const sampleAdditions = [
  "Carrots",
  "Tomatoes",
  "Onions",
  "Avocados",
  "Bell peppers",
  "Milk",
  "Greek yogurt",
  "Cheddar cheese",
  "Butter",
  "Eggs",
  "Chicken breast",
  "Ground beef",
  "Salmon fillets",
  "Olive oil",
  "Rice",
  "Pasta",
  "Canned tomatoes",
  "Black beans",
  "Oats",
  "Bread",
  "Peanut butter",
  "Mixed berries",
  "Frozen vegetables",
  "Ice cream",
  "Paper towels",
  "Trash bags",
  "Coffee beans",
  "Orange juice",
  "Sparkling water",
];

let inc = 1;
function nextSample() {
  return sampleAdditions[inc++ % sampleAdditions.length];
}

export const AddItem: FC = () => {
  const [placeholder, setPlaceholder] = useState(sampleAdditions[0]);
  const [state, setState] = useState("");
  const mutation = useMutation({
    mutationKey: ["addTodo"],
    mutationFn: addToServerState,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "end" }}>
      <input
        value={state}
        placeholder={placeholder}
        onChange={(e) => setState(e.target.value)}
        style={{ margin: "0.25rem", border: "2px solid" }}
      />
      <button
        onClick={() => {
          void mutation.mutate(state === "" ? placeholder : state);
          setPlaceholder(nextSample());
          setState("");
        }}
        style={{ backgroundColor: "ButtonHighlight", padding: ".0.125rem", cursor: "pointer" }}
      >
        Click here to try it out
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
    <ul style={{ listStyle: "inside", textAlign: "left" }}>
      {items.data.map((x) => (
        <li key={x.id}>{x.label}</li>
      ))}
    </ul>
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
        },
      ];
    },
  });
}
