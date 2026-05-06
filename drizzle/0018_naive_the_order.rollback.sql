-- Manual rollback companion for 0018_naive_the_order.sql
-- NOT executed by drizzle-kit.

DROP INDEX IF EXISTS "github_installations_repos_gin_idx";
