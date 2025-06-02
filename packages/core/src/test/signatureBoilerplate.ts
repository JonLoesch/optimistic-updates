import type { G, MutationState, stopInjection, SpecificDef, MutationWatch, AnyDef } from "./g";

type InjectionParametersBase<Def extends AnyDef> = {
  from: G<Def>["MutationLocator"];
  into: G<Def>["QueryLocator"];
  transform: InjectionTransform<
    Def,
    {
      input: Def["source"]["input"];
    } & MutationState<Def["source"]["output"]>
  >;
};

type InjectionParametersWithContext<Def extends AnyDef, TContext> = {
  from: G<Def>["MutationLocator"];
  into: G<Def>["QueryLocator"];
  context: (input: Def["source"]["input"]) => TContext;
  transform: InjectionTransform<
    Def,
    {
      input: Def["source"]["input"];
      context: TContext;
    } & MutationState<Def["source"]["output"]>
  >;
};

type InjectionParametersWithWatch<Def extends AnyDef, WatchResult> = {
  watch: MutationWatch<WatchResult>;
  into: G<Def>["QueryLocator"];
  transform: InjectionTransform<Def, WatchResult>;
};

type InjectionTransform<Def extends AnyDef, T> = (value: Def["target"]["output"], mutationState: T, queryInput: Def["target"]["input"]) => Def["target"]["output"] | typeof stopInjection;

export type InjectionParameters<Def extends AnyDef, TContext, WatchResult> =
  | InjectionParametersWithContext<Def, TContext>
  | InjectionParametersBase<Def>
  | InjectionParametersWithWatch<Def, WatchResult>;

export interface Engine {
  watch: {
    <Input, Output>(ml: G<SpecificDef<Input, unknown, Output, unknown, unknown, unknown>>["MutationLocator"]): MutationWatch<{ input: Input } & MutationState<Output>>;
    <Input, Output, Context>(
      ml: G<SpecificDef<Input, unknown, Output, unknown, unknown, unknown>>["MutationLocator"],
      context: (input: Input) => Context
    ): MutationWatch<
      {
        input: Input;
        context: Context;
      } & MutationState<Output>
    >;
    <Input, Output, Result>(
      ml: G<SpecificDef<Input, unknown, Output, unknown, unknown, unknown>>["MutationLocator"],
      result: (input: Input) => (data: Output) => Result
    ): MutationWatch<MutationState<Result>>;
  };

  inject: {
    <TSourceInput, TSourceError, TSourceOutput, TTargetInput, TTargetError, TTargetOutput, TContext>(
      params: InjectionParametersWithContext<SpecificDef<TSourceInput, TSourceError, TSourceOutput, TTargetInput, TTargetError, TTargetOutput>, TContext>
    ): void;
    <TSourceInput, TSourceError, TSourceOutput, TTargetInput, TTargetError, TTargetOutput>(
      params: InjectionParametersBase<SpecificDef<TSourceInput, TSourceError, TSourceOutput, TTargetInput, TTargetError, TTargetOutput>>
    ): void;
    <TSourceInput, TSourceError, TSourceOutput, TTargetInput, TTargetError, TTargetOutput, WatchResult>(
      params: InjectionParametersWithWatch<SpecificDef<TSourceInput, TSourceError, TSourceOutput, TTargetInput, TTargetError, TTargetOutput>, WatchResult>
    ): void;
  };
}
