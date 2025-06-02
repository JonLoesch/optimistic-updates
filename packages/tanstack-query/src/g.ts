import type { AnyDef } from "@optimistic-updates/core";
export type { AnyDef, MutationWatch, MutationState, stopInjection, SpecificDef } from "@optimistic-updates/core";
import { MutationFilters, Query, QueryFilters } from "@tanstack/query-core";

export type G<Def extends AnyDef = AnyDef> = {
  Query: Query<Def["target"]["output"], Def["target"]["error"]>;
  QueryLocator: QueryFilters;
  QueryHash: string;
  MutationLocator: MutationFilters;
};
