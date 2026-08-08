import type { Category } from '@finanzas/domain';

export interface CategoryNode {
  id: number;
  name: string;
  parentId: number | null;
  children: CategoryNode[];
}

/** Builds the nested tree from a flat category list (deleted categories already filtered out). */
export function buildTree(categories: Category[]): CategoryNode[] {
  const nodes = new Map<number, CategoryNode>();
  for (const cat of categories) {
    nodes.set(cat.id as number, { id: cat.id as number, name: cat.name, parentId: cat.parentId, children: [] });
  }
  const roots: CategoryNode[] = [];
  for (const cat of categories) {
    const node = nodes.get(cat.id as number) as CategoryNode;
    const parent = cat.parentId !== null ? nodes.get(cat.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
