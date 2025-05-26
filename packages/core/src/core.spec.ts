/* eslint-disable prefer-const */
import { Observable, ObservedValueOf, Observer, Subject } from "rxjs";
import { optimisticEngineCore, stopInjection } from "./core";
import type { Engine as TestEngine } from "./test/signatureBoilerplate";
import type { G, SpecificDef } from "./test/g";

describe("createAbstractOptimisticModel", () => {
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
      "status: pending input: params, output: ",
    ]);

    m.simulateSuccess({ m_output: "result" });
    expect(e.hooks.wrapValue(["value"], { fakeQuery: "" })).toEqual([
      "value",
      "status: success input: params, output: result",
    ]);
  });

  it("should stop injecting on failure", () => {
    const e = testEngine();
    basicPostprocess(e);

    let mockServerValue: G["QueryOutput"] = ["value"];
    const latestValue = () => e.hooks.wrapValue(mockServerValue, { fakeQuery: "" });
    expect(latestValue()).toEqual(["value"]);

    const m = simulateMutation(e, { m_input: "params" });
    expect(latestValue()).toEqual(["value", "status: pending input: params, output: "]);

    m.simulateFailure();
    expect(latestValue()).toEqual(["value"]);
  });

  it("should be able to generate a new ID for each mutation", () => {
    const e = testEngine();
    optimisticArrayInsert(e);

    let mockServerValue: G["QueryOutput"] = ["value"];
    const latestValue = () => e.hooks.wrapValue(mockServerValue, { fakeQuery: "" });
    expect(latestValue()).toEqual(["value"]);

    const m = simulateMutation(e, { m_input: "params" });
    expect(latestValue()).toEqual(["value", "OPTIMISTIC:ID:1:params"]);
    expect(latestValue()).toEqual(["value", "OPTIMISTIC:ID:1:params"]); // again to make sure it doesn't increment

    simulateMutation(e, { m_input: "params" });
    expect(latestValue()).toEqual(["value", "OPTIMISTIC:ID:1:params", "OPTIMISTIC:ID:2:params"]);

    m.simulateFailure();
    expect(latestValue()).toEqual(["value", "OPTIMISTIC:ID:2:params"]);
  });

  it("should stop injecting when value shows up on server", () => {
    const e = testEngine();
    optimisticArrayInsert(e);

    let mockServerValue: G["QueryOutput"] = ["value"];
    const latestValue = () => e.hooks.wrapValue(mockServerValue, { fakeQuery: "" });
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

    let mockServerValue: G["QueryOutput"] = ["value"];
    const latestValue = () => e.hooks.wrapValue(mockServerValue, { fakeQuery: "" });
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

  function to<Input = undefined, Output = G["QueryOutput"]>(
    prefix: string
  ): G<SpecificDef<unknown, unknown, unknown, Input, unknown, Output>>["QueryLocator"] {
    return {
      prefix,
      "~~input": undefined as Input,
      "~~output": undefined as Output,
    };
  }
  function from<Input = { m_input: string }, Output = { m_output: string }>(
    prefix: string
  ): G<SpecificDef<Input, unknown, Output, unknown, unknown, unknown>>["MutationLocator"] {
    return {
      prefix,
      "~~input": undefined as Input,
      "~~output": undefined as Output,
    };
  }

  function testEngine() {
    const triggerRefetch = jest.fn<undefined, [G["QueryLocator"]]>();
    const updateCache = jest.fn<undefined, [G["QueryLocator"], <T>(data: T, qh: G["Query"]) => T]>();
    const mutations$ = new Subject<{
      input: G["MutationInput"];
      isMatch: (ml: G["MutationLocator"]) => boolean;
      data$: Observable<G["MutationOutput"]>;
    }>();
    const queryCacheExpirations$ = new Subject<G["QueryHash"]>();

    const { engine, hooks } = optimisticEngineCore<G>({
      hashQuery: (q) => q.fakeQuery,
      queryInput: (q) => q.fakeQuery,
      matchQuery: (l, q) => q.fakeQuery.startsWith(l.prefix),
      triggerRefetch,
      updateCache,
      mutations$,
      queryCacheExpirations$,
    });

    return {
      engine: engine as TestEngine,
      hooks: {
        ...hooks,
        wrapValue: hooks.wrapValue<string[]>,
      },
      mocks: {
        triggerRefetch,
        updateCache,
        mutations$: mutations$ as Observer<ObservedValueOf<typeof mutations$>>,
      },
    };
  }

  function basicPostprocess(e: ReturnType<typeof testEngine>) {
    e.engine.inject({
      from: from(""),
      to: to(""),
      transform(value, mutationState) {
        return [
          ...value,
          `status: ${mutationState.status} input: ${mutationState.input.m_input}, output: ${mutationState.data?.m_output ?? ""}`,
        ];
      },
    });
  }

  function optimisticArrayInsert(e: ReturnType<typeof testEngine>) {
    let inc = 1;
    e.engine.inject({
      from: from(""),
      to: to(""),
      context: () => ({ fakeId: `ID:${inc++}` }),
      transform: (valuesFromServer: G["QueryOutput"], mutationState) => {
        if (mutationState.status === "success") {
          if (valuesFromServer.includes(mutationState.data.m_output)) {
            return stopInjection;
          } else {
            return [...valuesFromServer, `OPTIMISTIC:${mutationState.context.fakeId}:${mutationState.data.m_output}`];
          }
        } else {
          if (valuesFromServer.includes(mutationState.input.m_input)) {
            return valuesFromServer;
          } else {
            return [...valuesFromServer, `OPTIMISTIC:${mutationState.context.fakeId}:${mutationState.input.m_input}`];
          }
        }
      },
    });
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
      isMatch: ({ prefix }) => (options?.mutationKey ?? "").startsWith(prefix),
    });

    return {
      simulateSuccess(o) {
        data$.next({ m_output: "", ...o });
        data$.complete();
      },
      simulateFailure() {
        data$.error(new Error());
      },
    };
  }
});
