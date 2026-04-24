/**
 * Stale dev caches (Webpack) can still try to read this old path. Entity sync
 * now lives in `@/lib/supabase/entityTableSyncBrowser` — this module must stay
 * empty. Safe to remove after a clean `rm -rf .next` if your build is green.
 */
export {};
