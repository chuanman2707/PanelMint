# TDD Standards

These standards apply to behavior changes in `src/app`, `src/lib`, `src/app/api`, `src/components`, and `src/hooks`.

## Non-Negotiables

- Write the failing test first.
- Observe the failure before changing implementation.
- Make the smallest change that satisfies the test.
- Rerun the targeted test after the fix.
- Run the owning folder suite before opening a PR.
- Run broader repo checks when the change crosses multiple areas or needs extra confidence.

## Workflow

1. Capture the behavior in a test.
2. Confirm the test fails for the expected reason.
3. Implement the minimal code path.
4. Rerun the targeted test until it passes.
5. Run the suite for the folder you changed.
6. Run broader repo checks when the change crosses multiple areas or needs extra confidence.

## Folder Ownership

- `src/lib`: shared business logic, validation, utilities, and adapters.
- `src/app`: page/layout behavior, route composition, and app-level UI state.
- `src/app/api`: API routes, handlers, and server-side request orchestration.
- `src/components`: reusable UI components and component-level behavior.
- `src/hooks`: shared React hooks and hook-specific behavior.

## PR Expectations

- Include proof that the test failed before the fix.
- Include the targeted command used to verify the fix.
- Include the owning-folder suite command, and broader repo checks when they were run.
- Call out any risky folders touched, new mocks added, and follow-up tests deferred.
