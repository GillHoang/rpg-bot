/**
 * Minimal contract every repository follows. Kept intentionally small —
 * most repositories in this codebase need domain-specific finders
 * (findByDiscordId, findActiveBattle...) far more than generic CRUD, so
 * this interface exists mainly to document the pattern, not to force a
 * one-size-fits-all shape.
 */
export interface Repository<TEntity, TId> {
	findById(id: TId): Promise<TEntity | null>;
}
