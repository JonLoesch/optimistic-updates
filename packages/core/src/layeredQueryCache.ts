import type { Unsubscribable } from "rxjs";
import { getOrCreate } from "./getOrCreate";
import type { OptimisticUpdateGenericParameters } from "./types";

export const noMatch = Symbol("noMatch");

export class LayeredQueryCache<G extends OptimisticUpdateGenericParameters, T> {
  #layers = new SubList<CacheLayer<G["QueryHash"], G["Query"], T>>();

  *getOrCreate(
    hash: G["QueryHash"],
    params: G["Query"]
  ): Iterable<[T, Unsubscribable]> {
    for (const l of this.#layers) {
      const match = l.getOrCreate(hash, params);
      if (match !== noMatch)
        yield [match, { unsubscribe: () => l.delete(hash) }];
    }
  }

  delete(hash: G["QueryHash"]) {
    for (const l of this.#layers) {
      l.delete(hash);
    }
  }

  add(
    create: (
      subscription: Unsubscribable
    ) => CacheLayer<G["QueryHash"], G["Query"], T>
  ): Unsubscribable {
    return this.#layers.add(create);
  }

  gc() {
    for (const [l, s] of this.#layers.withUnsubscribe()) {
      if (l.canGC()) {
        s.unsubscribe();
      }
    }
  }
}

class SubList<T> implements Iterable<T> {
  #inc = 0;
  #all = new Map<number, T>();

  add(fn: (subscription: Unsubscribable) => T): Unsubscribable {
    const index = this.#inc++;
    const s = {
      unsubscribe: () => {
        this.#all.delete(index);
      }
    };
    this.#all.set(index, fn(s));
    return s;
  }

  [Symbol.iterator]() {
    return this.#all.values();
  }

  *withUnsubscribe() {
    for (const [index, x] of this.#all.entries()) {
      yield [x, { unsubscribe: () => this.#all.delete(index) }] as const;
    }
  }
}

export class CacheLayer<Hash extends PropertyKey, Params, Item> {
  #items = new Map<Hash, Item | typeof noMatch>();
  #isEmpty: undefined | boolean;

  constructor(
    private readonly impl: {
      create: (params: Params) => Item | typeof noMatch;
      canGC?: () => boolean;
    }
  ) {}

  getOrCreate(hash: Hash, params: Params) {
    return getOrCreate(this.#items, hash, () => {
      const match = this.impl.create(params);
      if (match !== noMatch) {
        this.#isEmpty = false;
      }
      return match;
    });
  }

  delete(hash: Hash) {
    this.#items.set(hash, noMatch);
    if (this.#isEmpty === false) {
      this.#isEmpty = undefined;
    }
  }

  canGC() {
    if (this.#isEmpty === false) return false;
    if (this.impl.canGC?.() === false) return false;
    if (this.#isEmpty === true) return true;
    for (const i of this.#items.values()) {
      if (i !== noMatch) {
        return (this.#isEmpty = false);
      }
    }
    return (this.#isEmpty = true);
  }
}
