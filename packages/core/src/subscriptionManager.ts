import { getOrCreate } from "./getOrCreate";

export const noMatch = Symbol("noMatch");
function isNoMatch(x: any): x is typeof noMatch {
  return x === noMatch;
}

interface DynamicLayerParameters<Trigger, Item> {
  createItem: (
    trigger: Trigger,
    lifecycle: {
      cleanupItem: () => void;
    }
  ) => { item: Item; onCleanupItem: () => void } | typeof noMatch;
}
interface DynamicLayer<Key, Trigger, Item> {
  createItem: (
    key: Key,
    trigger: Trigger
  ) =>
    | {
        item: Item;
        onCleanupItem: () => void;
        cleanupItem: () => void;
      }
    | typeof noMatch;
}

export class SubscriptionManager<Key extends PropertyKey, Trigger, Item> {
  #inc = 0;
  #all: DynamicLayer<Key, Trigger, Item>[] = [];
  addLayer(layer: DynamicLayerParameters<Trigger, Item>) {
    const index = this.#inc++;
    const handlers = new Map<Key, ReturnType<typeof layer.createItem>>();
    this.#all[index] = {
      createItem(key, trigger) {
        const data = getOrCreate(handlers, key, () =>
          layer.createItem(trigger, {
            cleanupItem: cleanupHandler
          })
        );
        if (data === noMatch) return noMatch;
        return {
          item: data.item,
          onCleanupItem: data.onCleanupItem,
          cleanupItem: cleanupHandler
        };
        function cleanupHandler() {
          if (data !== noMatch) data.onCleanupItem();
          handlers.delete(key);
        }
      }
    };
    return {
      unsubscribe: () => {
        // layer.onUnsubscribe?.();
        for (const h of handlers.values()) {
          if (h === noMatch) continue;
          h.onCleanupItem();
        }
        this.#all.splice(index, 1);
      }
    };
  }
  // #unsubscribeIfAble(index: number) {
  //   const layer = this.#all[index];
  //   if (layer?.canUnsubscribe?.() === true) {
  //     layer.onUnsubscribe?.();
  //     this.#all.splice(index, 1);
  //   }
  // }
  // #deferredCleanups?: Array<() => void>;
  // #cleanupEventually(fn: () => void) {
  //   if (this.#deferredCleanups) {
  //     this.#deferredCleanups.push(fn);
  //   } else {
  //     fn();
  //   }
  // }
  // deferCleanupTillEnd<T>(proc: () => T): T {
  //   if (this.#deferredCleanups) {
  //     return proc();
  //   } else {
  //     try {
  //       this.#deferredCleanups = [];
  //       const result = proc();
  //       this.#deferredCleanups.forEach((p) => p());
  //       return result;
  //     } finally {
  //       this.#deferredCleanups = [];
  //     }
  //   }
  // }
  *current(key: Key, trigger: Trigger) {
    for (const layer of this.#all.values()) {
      const handler = layer.createItem(key, trigger);
      if (handler === noMatch) continue;
      yield handler as Omit<typeof handler, "onCleanupHandler">;
    }
  }
}
