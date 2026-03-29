# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**panelmint** is an AI-powered manga/comic creation platform. Users create projects, write stories, generate storyboards and artwork via AI pipelines, then read finished episodes in a comic reader.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4 + Radix UI + shadcn/ui components
- **Database**: PostgreSQL + Prisma ORM 7
- **Auth**: Clerk (`@clerk/nextjs`)
- **Validation**: Zod 4
- **Testing**: Vitest (node environment, `src/**/*.test.ts`)
- **Background Jobs**: Inngest
- **AI**: WaveSpeed
- **Storage**: AWS S3
- **Canvas**: Fabric.js (comic editor)
- **Deployment**: Docker (Node 20 Alpine), Prisma migrations on startup

## Project Structure

```
src/
  app/              # Next.js App Router pages and API routes
    api/            # REST endpoints (auth, characters, editor, episodes, generate, health, inngest, user, webhooks)
    auth/           # Auth pages (Clerk)
    create/         # Project creation flow
    editor/         # Comic editor (Fabric.js canvas)
    read/           # Comic reader
    settings/       # User settings
  components/       # React components (ui/, layout/, editor/, dashboard/)
  lib/              # Shared utilities
    ai/             # AI provider integrations
    inngest/        # Background job definitions
    pipeline/       # Generation pipeline logic
    progress/       # Progress tracking
  hooks/            # React hooks
  workers/          # Web workers
prisma/
  schema.prisma     # Database schema
  postgres-baseline.sql
```

## Common Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run test         # Run tests (vitest)
npm run test:watch   # Tests in watch mode
npm run lint         # ESLint
npx prisma migrate dev   # Create/apply migration
npx prisma generate      # Regenerate Prisma client
```

## Code Conventions

- **Path alias**: Use `@/` for imports from `src/` (e.g., `import { prisma } from '@/lib/prisma'`)
- **API routes**: Use Next.js App Router route handlers in `src/app/api/`
- **API patterns**: Shared utilities in `src/lib/api-*.ts` (handler, validate, rate-limit, auth, config)
- **Error handling**: Use structured error types from `src/lib/errors.ts`
- **Components**: shadcn/ui primitives in `src/components/ui/`, feature components colocated by domain
- **Validation**: Zod schemas for all API input validation
- **Database**: Prisma schema uses `@@map()` for snake_case table names, camelCase fields
- **Environment**: Validation via `src/lib/env-validation.ts` — all env vars must be registered there

## Testing

- Test files: `src/**/*.test.ts`
- Environment: Node (not jsdom)
- Path alias `@/` is configured in vitest
- Run `npm test` before committing changes

## Workflow Best Practices

- Keep context focused — perform `/compact` at ~50% context usage
- Start with plan mode for complex multi-step tasks
- Break subtasks small enough to complete in under 50% context
- Use subagents for independent parallel work
- Run `npm test` and `npm run lint` before claiming work is complete

## Security

- CSP headers configured in `next.config.ts`
- Clerk handles auth — never store raw passwords
- API routes use rate limiting (`src/lib/api-rate-limit.ts`)
- S3 presigned URLs for file uploads — never expose AWS keys to client
- Never commit `.env` files

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **panelmint** (664 symbols, 1622 relationships, 46 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/panelmint/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/panelmint/context` | Codebase overview, check index freshness |
| `gitnexus://repo/panelmint/clusters` | All functional areas |
| `gitnexus://repo/panelmint/processes` | All execution flows |
| `gitnexus://repo/panelmint/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
