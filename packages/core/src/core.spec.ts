/* eslint-disable prefer-const */
import { Observable, ObservedValueOf, Observer, Subject } from "rxjs";
import {
  _WatchMutationResultFunc,
  createAbstractOptimisticModel,
  defaultResultState,
  ResultOf,
  stopInjection
} from "./core";

describe("createAbstractOptimisticModel", () => {
  type G = {
    Query: { fakeQuery: string };
    QueryHash: string;
    QueryLocator: { prefix: string };
    MutationLocator: { prefix: string };
    MutationInput: { m_input: string };
    MutationOutput: { m_output: string };
    QueryResult: string[];
  };

  it("should be able to pass through values", () => {
    const e = testEngine();
    expect(e.hooks.wrapValue(["value"], { fakeQuery: "" })).toEqual(["value"]);
  });

  it("should be able to modify values", () => {
    const e = testEngine();
    basicPostprocess(e);
    expect(e.hooks.wrapValue(["value"], { fakeQuery: "" })).toEqual(["value"]);

    const m = simulateMutation(e, { m_input: "params" });
    expect(e.hooks.wrapValue(["value"], { fakeQuery: "" })).toEqual([
      "value",
      "status: pending input: params, output: "
    ]);

    m.simulateSuccess({ m_output: "result" });
    expect(e.hooks.wrapValue(["value"], { fakeQuery: "" })).toEqual([
      "value",
      "status: success input: params, output: result"
    ]);
  });

  it("should stop injecting on failure", () => {
    const e = testEngine();
    basicPostprocess(e);

    let mockServerValue: G["QueryResult"] = ["value"];
    const latestValue = () =>
      e.hooks.wrapValue(mockServerValue, { fakeQuery: "" });
    expect(latestValue()).toEqual(["value"]);

    const m = simulateMutation(e, { m_input: "params" });
    expect(latestValue()).toEqual([
      "value",
      "status: pending input: params, output: "
    ]);

    m.simulateFailure();
    expect(latestValue()).toEqual(["value"]);
  });

  it("should be able to generate a new ID for each mutation", () => {
    const e = testEngine();
    optimisticArrayInsert(e);

    let mockServerValue: G["QueryResult"] = ["value"];
    const latestValue = () =>
      e.hooks.wrapValue(mockServerValue, { fakeQuery: "" });
    expect(latestValue()).toEqual(["value"]);

    const m = simulateMutation(e, { m_input: "params" });
    expect(latestValue()).toEqual(["value", "OPTIMISTIC:ID:1:params"]);
    expect(latestValue()).toEqual(["value", "OPTIMISTIC:ID:1:params"]); // again to make sure it doesn't increment

    simulateMutation(e, { m_input: "params" });
    expect(latestValue()).toEqual([
      "value",
      "OPTIMISTIC:ID:1:params",
      "OPTIMISTIC:ID:2:params"
    ]);

    m.simulateFailure();
    expect(latestValue()).toEqual(["value", "OPTIMISTIC:ID:2:params"]);
  });

  it("should stop injecting when value shows up on server", () => {
    const e = testEngine();
    optimisticArrayInsert(e);

    let mockServerValue: G["QueryResult"] = ["value"];
    const latestValue = () =>
      e.hooks.wrapValue(mockServerValue, { fakeQuery: "" });
    expect(latestValue()).toEqual(["value"]);

    const m = simulateMutation(e, { m_input: "params" });
    expect(latestValue()).toEqual(["value", "OPTIMISTIC:ID:1:params"]);

    m.simulateSuccess({ m_output: "inserted" });
    expect(latestValue()).toEqual(["value", "OPTIMISTIC:ID:1:inserted"]);

    mockServerValue = ["value", "inserted"];
    expect(latestValue()).toEqual(["value", "inserted"]);

    // should have stopped injecting so if it disappears from the server it won't come back
    mockServerValue = ["value"];
    expect(latestValue()).toEqual(["value"]);
  });

  it("should not double insert if the server updates before the mutation returns", () => {
    const e = testEngine();
    optimisticArrayInsert(e);

    let mockServerValue: G["QueryResult"] = ["value"];
    const latestValue = () =>
      e.hooks.wrapValue(mockServerValue, { fakeQuery: "" });
    expect(latestValue()).toEqual(["value"]);

    const m = simulateMutation(e, { m_input: "newValue" });
    expect(latestValue()).toEqual(["value", "OPTIMISTIC:ID:1:newValue"]);

    mockServerValue = ["value", "newValue"];
    expect(latestValue()).toEqual(["value", "newValue"]);

    // should still be injecting at this point
    mockServerValue = ["value"];
    expect(latestValue()).toEqual(["value", "OPTIMISTIC:ID:1:newValue"]);

    mockServerValue = ["value", "newValue"];
    expect(latestValue()).toEqual(["value", "newValue"]);

    m.simulateSuccess({ m_output: "newValue" });
    expect(latestValue()).toEqual(["value", "newValue"]);

    // should have stopped injecting so if it disappears from the server it won't come back
    mockServerValue = ["value"];
    expect(latestValue()).toEqual(["value"]);
  });

  // --------------------------------------------------------- //
  // --------------------------------------------------------- //
  // --------------------------------------------------------- //
  // Helper methods
  // --------------------------------------------------------- //
  // --------------------------------------------------------- //
  // --------------------------------------------------------- //

  function testEngine() {
    const triggerRefetch = jest.fn<undefined, [G["QueryLocator"]]>();
    const updateCache = jest.fn<
      undefined,
      [G["QueryLocator"], <T>(data: T, qh: G["Query"]) => T]
    >();
    const mutations$ = new Subject<{
      input: G["MutationInput"];
      isMatch: (ml: G["MutationLocator"]) => boolean;
      data$: Observable<G["MutationOutput"]>;
    }>();

    const { model, hooks } = createAbstractOptimisticModel<G>({
      hashQuery: (q) => q.fakeQuery,
      matchQuery: (l, q) => q.fakeQuery.startsWith(l.prefix),
      triggerRefetch,
      updateCache,
      mutations$
    });

    return {
      model: {
        ...model,
        _watchMutation<
          F extends _WatchMutationResultFunc<
            G["MutationInput"],
            G["MutationOutput"]
          >
        >(ml: G["MutationLocator"], fn: F) {
          return model.watchMutation(
            ml,
            defaultResultState<G["MutationInput"], G["MutationOutput"], F>(fn)
          );
        }
      },
      hooks: {
        ...hooks,
        wrapValue: hooks.wrapValue<string[]>
      },
      mocks: {
        triggerRefetch,
        updateCache,
        mutations$: mutations$ as Observer<ObservedValueOf<typeof mutations$>>
      }
    };
  }

  function basicPostprocess(
    e: ReturnType<typeof testEngine>,
    options?: Partial<{
      queryPrefix: string;
      mutationPrefix: string;
      inject: (
        value: string[],
        mutationState: ResultOf<
          G["MutationInput"],
          G["MutationOutput"],
          undefined
        >
      ) => string[] | typeof stopInjection;
    }>
  ) {
    e.model.postprocessQuery(
      { prefix: options?.queryPrefix ?? "" },
      e.model._watchMutation(
        { prefix: options?.mutationPrefix ?? "" },
        undefined
      ),
      options?.inject ??
        ((value: string[], mutationState) => {
          return [
            ...value,
            `status: ${mutationState.status} input: ${mutationState.input.m_input}, output: ${mutationState.data?.m_output ?? ""}`
          ];
        })
    );
  }

  function optimisticArrayInsert(e: ReturnType<typeof testEngine>) {
    let inc = 1;
    e.model.postprocessQuery(
      { prefix: "" },
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      e.model._watchMutation({ prefix: "" }, () => ({ fakeId: `ID:${inc++}` })),
      (valuesFromServer: G["QueryResult"], mutationState) => {
        if (mutationState.status === "success") {
          if (valuesFromServer.includes(mutationState.data.m_output)) {
            return stopInjection;
          } else {
            return [
              ...valuesFromServer,
              `OPTIMISTIC:${mutationState.context.fakeId}:${mutationState.data.m_output}`
            ];
          }
        } else {
          if (valuesFromServer.includes(mutationState.input.m_input)) {
            return valuesFromServer;
          } else {
            return [
              ...valuesFromServer,
              `OPTIMISTIC:${mutationState.context.fakeId}:${mutationState.input.m_input}`
            ];
          }
        }
      }
    );
  }

  function simulateMutation(
    e: ReturnType<typeof testEngine>,
    options?: Partial<
      {
        mutationKey: string;
      } & G["MutationInput"]
    >
  ): {
    simulateSuccess: (options?: Partial<G["MutationOutput"]>) => void;
    simulateFailure: () => void;
  } {
    const data$ = new Subject<G["MutationOutput"]>();
    e.mocks.mutations$.next({
      data$,
      input: { m_input: "", ...options },
      isMatch: ({ prefix }) => (options?.mutationKey ?? "").startsWith(prefix)
    });

    return {
      simulateSuccess(o) {
        data$.next({ m_output: "", ...o });
        data$.complete();
      },
      simulateFailure() {
        data$.error(new Error());
      }
    };
  }
});
