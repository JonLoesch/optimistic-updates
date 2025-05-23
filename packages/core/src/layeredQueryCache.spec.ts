/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Unsubscribable } from "rxjs";
import { CacheLayer, LayeredQueryCache, noMatch } from "./layeredQueryCache";

describe("LayeredQueryCache", () => {
  type G = {
    Query: { fakeQuery: string };
    QueryHash: string;
    QueryLocator: never;
    MutationLocator: never;
  };
  it("should be able to iterate", () => {
    const cache = new LayeredQueryCache<G, number>();
    cache.add(() => new CacheLayer({ create: () => 1 }));
    cache.add(() => new CacheLayer({ create: () => 2 }));
    cache.add(() => new CacheLayer({ create: () => 3 }));
    expect(itemsOf(cache)).toEqual([1, 2, 3]);
  });

  it("should be able to remove layers by unsubscribing", () => {
    const cache = new LayeredQueryCache<G, number>();
    cache.add(() => new CacheLayer({ create: () => 1 }));
    const subscription = cache.add(() => new CacheLayer({ create: () => 2 }));
    cache.add(() => new CacheLayer({ create: () => 3 }));
    expect(itemsOf(cache)).toEqual([1, 2, 3]);

    subscription.unsubscribe();
    expect(itemsOf(cache)).toEqual([1, 3]);
    expect(itemsOf(cache, "another key")).toEqual([1, 3]);
  });

  it("should be able to delete values", () => {
    const cache = new LayeredQueryCache<G, number>();
    cache.add(() => new CacheLayer({ create: () => 1 }));
    cache.add(() => new CacheLayer({ create: () => 2 }));
    cache.add(() => new CacheLayer({ create: () => 3 }));

    expect(itemsOf(cache)).toEqual([1, 2, 3]);
    expect(itemsOf(cache, "another key")).toEqual([1, 2, 3]);

    cache.delete("another key");
    expect(itemsOf(cache)).toEqual([1, 2, 3]);
    expect(itemsOf(cache, "another key")).toEqual([]);
  });

  it("should be able to remove layers by unsubscribing from callback", () => {
    const cache = new LayeredQueryCache<G, number>();
    let subscription: Unsubscribable;
    cache.add(() => new CacheLayer({ create: () => 1 }));
    cache.add((s) => {
      subscription = s;
      return new CacheLayer({ create: () => 2 });
    });
    cache.add(() => new CacheLayer({ create: () => 3 }));
    expect(itemsOf(cache)).toEqual([1, 2, 3]);

    subscription!.unsubscribe();
    expect(itemsOf(cache)).toEqual([1, 3]);
    expect(itemsOf(cache, "another key")).toEqual([1, 3]);
  });

  it("should be able to filter queries", () => {
    const cache = new LayeredQueryCache<G, number>();
    cache.add(() => new CacheLayer({ create: () => 1 }));
    cache.add(
      () =>
        new CacheLayer({
          create: (q) => (/^[aeiou]/i.test(q.fakeQuery) ? 2 : noMatch)
        })
    );
    cache.add(() => new CacheLayer({ create: () => 3 }));

    expect(itemsOf(cache)).toEqual([1, 3]);
    expect(itemsOf(cache, "consonant")).toEqual([1, 3]);
    expect(itemsOf(cache, "a vowel")).toEqual([1, 2, 3]);
  });

  it("should cache results", () => {
    let inc = 1;
    const cache = new LayeredQueryCache<G, number>();
    cache.add(() => new CacheLayer({ create: () => inc++ }));
    cache.add(() => new CacheLayer({ create: () => inc++ }));
    cache.add(() => new CacheLayer({ create: () => inc++ }));

    expect(itemsOf(cache)).toEqual([1, 2, 3]);
    expect(itemsOf(cache)).toEqual([1, 2, 3]);
    expect(itemsOf(cache, "different key")).toEqual([4, 5, 6]);
  });

  it("should GC when able", () => {
    const cache = new LayeredQueryCache<G, number>();
    cache.add(() => new CacheLayer({ create: () => 1 }));
    cache.add(
      () =>
        new CacheLayer({
          create: (q) => (/^[aeiou]/i.test(q.fakeQuery) ? 2 : noMatch)
        })
    );
    cache.add(() => new CacheLayer({ create: () => 3 }));

    expect(itemsOf(cache, "a key")).toEqual([1, 2, 3]);
    expect(itemsOf(cache, "different key")).toEqual([1, 3]);

    cache.delete("a key");
    expect(itemsOf(cache, "a key")).toEqual([]);
    expect(itemsOf(cache, "different key")).toEqual([1, 3]);

    cache.gc();
    expect(itemsOf(cache, "a key")).toEqual([]);
    expect(itemsOf(cache, "different key")).toEqual([1, 3]);

    expect(itemsOf(cache, "a third key")).toEqual([1, 3]);
    // 2 is NOT in this list because its layer should have been removed by the GC call.
    // Layer 2 had zero matching queries at the time of the GC call so it was removed
  });

  it("should respect can GC hook", () => {
    const cache = new LayeredQueryCache<G, number>();
    const canGc = jest.fn<boolean, []>();
    cache.add(() => new CacheLayer({ create: () => 1 }));
    cache.add(
      () =>
        new CacheLayer({
          create: (q) => (/^[aeiou]/i.test(q.fakeQuery) ? 2 : noMatch),
          canGC: canGc
        })
    );
    cache.add(() => new CacheLayer({ create: () => 3, canGC: canGc }));
    canGc.mockReturnValue(false);

    expect(itemsOf(cache, "a key")).toEqual([1, 2, 3]);
    expect(itemsOf(cache, "different key")).toEqual([1, 3]);

    cache.delete("a key");
    expect(itemsOf(cache, "a key")).toEqual([]);
    expect(itemsOf(cache, "different key")).toEqual([1, 3]);

    cache.gc();
    expect(itemsOf(cache, "a key")).toEqual([]);
    expect(itemsOf(cache, "different key")).toEqual([1, 3]);
    expect(itemsOf(cache, "a third key")).toEqual([1, 2, 3]);

    canGc.mockReturnValue(true);
    cache.gc();
    expect(itemsOf(cache, "a key")).toEqual([]);
    expect(itemsOf(cache, "different key")).toEqual([1, 3]);
    expect(itemsOf(cache, "a third key")).toEqual([1, 2, 3]);

    cache.delete("a third key");
    cache.gc();
    expect(itemsOf(cache, "a key")).toEqual([]);
    expect(itemsOf(cache, "different key")).toEqual([1, 3]);
    expect(itemsOf(cache, "a third key")).toEqual([]);

    expect(itemsOf(cache, "a fourth key")).toEqual([1, 3]);
    // 2 is NOT in this list because its layer should have been removed by the GC call.
    // Layer 2 had zero matching queries at the time of the GC call so it was removed
  });

  function itemsOf<T>(cache: LayeredQueryCache<G, T>, fakeQuery = ""): T[] {
    return [...cache.getOrCreate(fakeQuery, { fakeQuery })].map(([x]) => x);
  }
});
