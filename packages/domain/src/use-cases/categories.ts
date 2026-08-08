import { Category } from '../entities/category';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import type { CategoryRepository, Clock } from '../ports/repositories';

export interface CategoryServiceDeps {
  categories: CategoryRepository;
  clock: Clock;
}

/**
 * Category tree use cases (CM-1..5). Cycle prevention walks the parent chain
 * (adjacency list, O(depth)); soft-delete keeps rows for history (CM-4, PS-5).
 */
export class CategoryService {
  constructor(private deps: CategoryServiceDeps) {}

  async create(input: { name: string; parentId?: number | null }): Promise<Category> {
    const parentId = input.parentId ?? null;
    if (parentId !== null) {
      await this.assertUsableParent(parentId);
    }
    const cat = new Category({ name: input.name, parentId, deletedAt: null });
    return this.deps.categories.create(cat);
  }

  /** Rename keeps the stable id; transactions keep referencing it (CM-3, CM-5). */
  async rename(id: number, name: string): Promise<Category> {
    const existing = await this.getActive(id);
    return this.save(id, new Category({ ...existing, name }));
  }

  async move(id: number, parentId: number | null): Promise<Category> {
    const existing = await this.getActive(id);
    if (parentId === id) {
      throw new ConflictError('A category cannot be its own parent');
    }
    if (parentId !== null) {
      await this.assertUsableParent(parentId);
      if (await this.isDescendantOf(parentId, id)) {
        throw new ConflictError('Cannot move a category under one of its own descendants');
      }
    }
    return this.save(id, new Category({ ...existing, parentId }));
  }

  /** Soft-delete: hidden from pickers, kept for history (CM-4). */
  async remove(id: number, deletedAt: string): Promise<Category> {
    const existing = await this.getActive(id);
    if (await this.deps.categories.hasChildren(id)) {
      throw new ConflictError('Cannot delete a category with children', ['delete its children first']);
    }
    return this.save(id, new Category({ ...existing, deletedAt }));
  }

  listActive(): Promise<Category[]> {
    return this.deps.categories.listAll().then((all) => all.filter((c) => c.deletedAt === null));
  }

  listAll(): Promise<Category[]> {
    return this.deps.categories.listAll();
  }

  private async save(id: number, cat: Category): Promise<Category> {
    const stored = await this.deps.categories.update(id, cat);
    if (!stored) throw new NotFoundError(`Category ${id} not found`);
    return stored;
  }

  private async getActive(id: number): Promise<Category> {
    const cat = await this.deps.categories.findById(id);
    if (!cat || cat.deletedAt !== null) throw new NotFoundError(`Category ${id} not found`);
    return cat;
  }

  private async assertUsableParent(parentId: number): Promise<void> {
    const parent = await this.deps.categories.findById(parentId);
    if (!parent) throw new NotFoundError(`Category ${parentId} not found`);
    if (parent.deletedAt !== null) {
      throw new ValidationError('Cannot use a deleted category as parent', [`category ${parentId} is deleted`]);
    }
  }

  /** True when candidateId sits inside the subtree rooted at ancestorId. */
  private async isDescendantOf(candidateId: number, ancestorId: number): Promise<boolean> {
    const all = await this.deps.categories.listAll();
    const byId = new Map(all.map((c) => [c.id as number, c]));
    let current = byId.get(candidateId);
    while (current && current.parentId !== null) {
      if (current.parentId === ancestorId) return true;
      current = byId.get(current.parentId);
    }
    return false;
  }
}
