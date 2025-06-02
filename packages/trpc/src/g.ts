import type { AnyDef } from "@optimistic-updates/core";
export type { AnyDef, MutationWatch, MutationState, stopInjection, SpecificDef } from "@optimistic-updates/core";
import type { TRPCMutationKey, TRPCQueryKey } from "@trpc/tanstack-react-query";

export type G<Def extends AnyDef = AnyDef> = {
  Query: {
    path: string[];
    input: Def["target"]["input"];
  };
  QueryLocator: {
    queryKey: () => TRPCQueryKey;
    "~types": {
      input: Def["target"]["input"];
      output: Def["target"]["output"];
      errorShape: Def["target"]["error"];
    };
  };
  QueryHash: string;
  MutationLocator: {
    mutationKey: () => TRPCMutationKey;
    "~types": {
      input: Def["source"]["input"];
      output: Def["source"]["output"];
      errorShape: Def["source"]["error"];
    };
  };
};
