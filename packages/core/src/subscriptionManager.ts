import { getOrCreate } from "./getOrCreate";

export const noMatch = Symbol("noMatch");

interface DynamicLayerParameters<Trigger, Item> {
  createItem: (
    trigger: Trigger,
    lifecycle: {
      cleanupItem: () => void;
    }
  ) => { item: Item; onCleanupItem?: () => void } | typeof noMatch;
}
interface DynamicLayer<Key, Trigger, Item>
  extends DynamicLayerParameters<Trigger, Item> {
  items: Map<
    Key,
    ReturnType<DynamicLayerParameters<Trigger, Item>["createItem"]>
  >;
}

export class SubscriptionManager<Key extends PropertyKey, Trigger, Item> {
  #inc = 0;
  #all = new Map<number, DynamicLayer<Key, Trigger, Item>>();
  addLayer(layer: DynamicLayerParameters<Trigger, Item>) {
    const index = this.#inc++;
    const handlers = new Map<Key, ReturnType<typeof layer.createItem>>();
    this.#all.set(index, {
      ...layer,
      items: handlers
      // createItem(key, trigger) {
      //   if (data === noMatch) return noMatch;
      // }
    });
    return {
      clearCache,
      unsubscribe: () => {
        // layer.onUnsubscribe?.();
        clearCache();
        this.#all.delete(index);
      }
    };
    function clearCache() {
      for (const h of handlers.values()) {
        if (h === noMatch) continue;
        h.onCleanupItem?.();
      }
    }
  }
  *getOrCreate(key: Key, trigger: Trigger) {
    for (const layer of this.#all.values()) {
      const data = getOrCreate(layer.items, key, () =>
        layer.createItem(trigger, {
          cleanupItem
        })
      );
      if (data === noMatch) continue;
      yield {
        item: data.item,
        cleanupItem
      };
      function cleanupItem() {
        if (data !== noMatch) data.onCleanupItem?.();
        layer.items.delete(key);
      }
    }
  }
  *get(key: Key) {
    for (const layer of this.#all.values()) {
      const data = layer.items.get(key);
      if (data === noMatch || !data) continue;
      yield {
        item: data.item,
        cleanupItem
      };
      function cleanupItem() {
        if (data !== noMatch) data?.onCleanupItem?.();
        layer.items.delete(key);
      }
    }
  }
}
