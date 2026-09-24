/**
 * Menu module public API. The router stays the entry point; GameplayService
 * only orchestrates module use-cases and renders panels from snapshots.
 */
export { MenuRouter } from './MenuRouter.js';
export { MenuGameplayService } from './MenuGameplayService.js';
export * from '../../db/tables/menu.js';
