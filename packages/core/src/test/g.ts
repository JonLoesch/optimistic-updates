import { AnyDef } from "../core";

export type { MutationState, stopInjection, SpecificDef, MutationWatch, AnyDef } from "../core";

export type G<Def extends AnyDef = AnyDef> = {
  Query: { fakeQuery: string };
  QueryHash: string;
  QueryLocator: { prefix: string; "~~input": Def["target"]["input"]; "~~output": Def["target"]["output"] };
  MutationLocator: { prefix: string; "~~input": Def["source"]["input"]; "~~output": Def["source"]["output"] };

  // TODO fix this???
  QueryOutput: string[];
  MutationOutput: { m_output: string };
  MutationInput: { m_input: string };
};
