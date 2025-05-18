import type { QueryKey } from "@tanstack/query-core";

export function partialMatchKey(a: QueryKey, b: QueryKey): boolean {
  return _partialMatchKey(a, b);
}

function _partialMatchKey(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }

  if (typeof a !== typeof b) {
    return false;
  }

  if (a && b && typeof a === "object" && typeof b === "object") {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return Object.keys(b).every((key) => _partialMatchKey(a[key], b[key]));
  }

  return false;
}
