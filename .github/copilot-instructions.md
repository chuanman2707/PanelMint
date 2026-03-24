# Repository Copilot instructions

This workspace contains Copilot-native project skills under `.github/skills`. When a task matches one of these skills, prefer loading the smallest relevant skill instead of reading the entire legacy `.agent` tree.

## Available migrated skills

- `brainstorming`: use for vague requests, new features, or requests that need blocking questions before implementation.
- `app-builder`: use when planning or scaffolding application features or new apps.
- `webapp-testing`: use when designing, writing, or debugging browser and E2E web tests.

## Working rules

- Match the user's language for explanations; keep source code and code comments in English.
- Make precise, behavior-safe changes that follow the existing project patterns.
- Run only the lint, build, and test commands that already exist in the repository.
- Treat `.agent/` as legacy reference material. Prefer `.github/skills` first for migrated capabilities, and only consult `.agent/` when a needed skill has not been migrated yet.
- Do not load unrelated skill files. Read `SKILL.md` first, then only the supporting files that the task actually needs.
