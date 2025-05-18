import { getOrCreate } from "./getOrCreate";

export const noMatch = Symbol("noMatch");

type WithCleanup<Handler> = Handler & {
  onCleanupHandler: () => void;
};
interface DynamicLayerParameters<Trigger, Handler> {
  createHandler: (
    trigger: Trigger,
    lifecycle: {
      cleanupHandler: () => void;
    }
  ) =>
    | (Handler & {
        onCleanupHandler: () => void;
      })
    | typeof noMatch;
}
interface DynamicLayer<Key, Trigger, Handler> {
  createHandler: (
    key: Key,
    trigger: Trigger
  ) =>
    | (Handler & {
        onCleanupHandler: () => void;
        cleanupHandler: () => void;
      })
    | typeof noMatch;
}

export class SubscriptionManager<Key extends PropertyKey, Trigger, Handler> {
  #inc = 0;
  #all: DynamicLayer<Key, Trigger, Handler>[] = [];
  addLayer(layer: DynamicLayerParameters<Trigger, Handler>) {
    const index = this.#inc++;
    const handlers = new Map<
      Key,
      Exclude<ReturnType<typeof layer.createHandler>, typeof noMatch>
    >();
    this.#all[index] = {
      ...layer,
      createHandler(key, trigger) {
        const handler = getOrCreate(
          handlers,
          key,
          () =>
            layer.createHandler(trigger, {
              cleanupHandler
            }),
          (x) => x === noMatch
        );
        if (handler === noMatch) return noMatch;
        return {
          ...handler,
          cleanupHandler
        };
        function cleanupHandler() {
          if (handler !== noMatch) handler.onCleanupHandler();
          handlers.delete(key);
        }
      }
    };
    return {
      unsubscribe: () => {
        // layer.onUnsubscribe?.();
        for (const h of handlers.values()) {
          h.onCleanupHandler();
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
  active(key: Key, trigger: Trigger) {
    // return this.deferCleanupTillEnd(() => this.#active(key, trigger));
    return this.#active(key, trigger);
  }
  *#active(key: Key, trigger: Trigger) {
    for (const layer of this.#all.values()) {
      const handler = layer.createHandler(key, trigger);
      if (handler === noMatch) continue;
      yield handler as Omit<typeof handler, "onCleanupHandler">;
    }
  }
}
