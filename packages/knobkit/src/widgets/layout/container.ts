import { idOf, spawnTree } from "@knobkit/core";
import type { Lens } from "@knobkit/core";

export interface ContainerMethods {
  /** Add a widget (declared elsewhere or freshly created in a handler) at `index` (default: end). */
  add(child: unknown, index?: number): void;
  removeChild(child: unknown): Promise<void>;
}

export function containerMethods(items: () => Lens<unknown[]>): ContainerMethods {
  return {
    add(child, index) {
      let id: string;
      try {
        id = idOf(child); // already part of the app — just re-parent/append
      } catch {
        id = spawnTree(child);
      }
      if (index == null) items().append(id);
      else items().insert(index, id);
    },
    async removeChild(child) {
      const id = idOf(child);
      const current = (await items().get()) as string[];
      const index = current.indexOf(id);
      if (index >= 0) items().removeAt(index);
    },
  };
}
