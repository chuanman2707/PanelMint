# GitNexus Analysis: waoowaoo

> Full-Stack AI Comic/Manga Platform - Reference Project
> Analyzed: 2026-03-23 | Commit: `9aff44e` | Remote: github.com/saturndec/waoowaoo

## Stats

| Metric | Count |
|--------|-------|
| Files | 1,320 |
| Symbols | 6,617 |
| Edges | 20,392 |
| Clusters | 553 |
| Flows | 300 |

## Functional Modules (Top 20 of 84)

| Module | Symbols | Cohesion |
|--------|---------|----------|
| **Hooks** | 293 | 67% |
| **Handlers** | 231 | 79% |
| **Mutations** | 176 | 54% |
| **Task** | 123 | 75% |
| **Scripts** | 120 | 78% |
| **Billing** | 107 | 56% |
| **Api-config** | 93 | 65% |
| **Migrations** | 76 | 86% |
| **Media** | 69 | 74% |
| **Llm** | 65 | 72% |
| **Run-stream** | 64 | 84% |
| **Workers** | 59 | 63% |
| **Logging** | 56 | 79% |
| **Assets** | 56 | 76% |
| **Voice** | 54 | 64% |
| **Providers** | 48 | 89% |
| **Model-template** | 46 | 66% |
| **Components** | 45 | 75% |
| **Openai-compat** | 43 | 72% |
| **Ui** | 42 | 82% |

## Key Execution Flows (Top 20 of 300)

| Flow | Steps | Type |
|------|-------|------|
| UsePanelCandidates → ToMessage | 10 | cross_community |
| UsePanelCandidates → IsKnownErrorCode | 9 | cross_community |
| UsePanelCandidates → ContainsAny | 9 | cross_community |
| ScriptView → ResolveRequestPathname | 9 | cross_community |
| ProjectDetailPage → ToMessage | 8 | cross_community |
| ProjectDetailPage → GetErrorSpec | 8 | cross_community |
| Start → IsLifecycleEventType | 7 | cross_community |
| Start → IsTaskIntent | 7 | cross_community |
| Start → ResolveTaskIntent | 7 | cross_community |
| HandleScriptToStoryboardTask → IsEdgeOrBrowser | 7 | cross_community |
| HandleStoryToScriptTask → IsEdgeOrBrowser | 7 | cross_community |
| ProjectDetailPage → IsKnownErrorCode | 7 | cross_community |
| ProjectDetailPage → ContainsAny | 7 | cross_community |
| HandleReferenceToCharacterTask → SerializeError | 7 | cross_community |
| HandleReferenceToCharacterTask → NormalizeDetails | 7 | cross_community |
| UsePanelCrudActions → ResolveLocaleFromPath | 7 | cross_community |
| UsePanelCrudActions → AsObject | 7 | cross_community |
| UsePanelCrudActions → AsString | 7 | cross_community |
| HandleLLMProxyTask → SerializeError | 7 | cross_community |
| HandleLLMProxyTask → NormalizeDetails | 7 | cross_community |

## Architecture Summary

A **production-grade** AI comic/manga platform with extensive infrastructure:

### Core Domains
- **Task System** (123 symbols) — Job queue, lifecycle events, task intents, deduplication
- **Workers** (59 symbols) — Background processors: `ScriptToStoryboard`, `StoryToScript`, `VoiceAnalyze`, `LLMProxy`, `ReferenceToCharacter`
- **Billing** (107 symbols) — Subscription, usage tracking, payment integration
- **Run-stream** (64 symbols) — Real-time run status streaming

### AI/ML Pipeline
- **LLM** (65 symbols) — Multi-provider LLM orchestration
- **Openai-compat** (43 symbols) — OpenAI-compatible API gateway
- **Providers** (48 symbols) — Fal, Google, Ark image providers
- **Model-template** (46 symbols) — Prompt template management
- **Voice** (54 symbols) — Voice analysis and generation

### Frontend
- **Hooks** (293 symbols) — React hooks for panels, CRUD, candidates
- **Components** (45 symbols) — Reusable UI components
- **Assets** (56 symbols) — Asset management (characters, locations)
- **Ui** (42 symbols) — Design system components

### Infrastructure
- **Handlers** (231 symbols) — API route handlers
- **Mutations** (176 symbols) — Data mutation layer
- **Api-config** (93 symbols) — API configuration and routing
- **Logging** (56 symbols) — Structured logging system
- **Migrations** (76 symbols) — Database schema migrations
- **Media** (69 symbols) — File storage and media processing
- **Scripts** (120 symbols) — Build scripts, guards, automation

## Comparison with weoweo (MVP)

| Aspect | weoweo (MVP) | waoowaoo (Full) |
|--------|-------------|-----------------|
| Files | 93 | 1,320 |
| Symbols | 424 | 6,617 |
| Flows | 30 | 300 |
| Modules | 40 | 553 |
| Pipeline | 3-stage linear | Multi-worker parallel |
| Billing | ❌ | ✅ Full system |
| Voice | ❌ | ✅ Analysis + Gen |
| Streaming | ❌ | ✅ Run-stream |
| i18n | ❌ | ✅ Multi-locale |
| Tests | Basic | Extensive (unit/int/system/regression) |

## Usage

```bash
# Re-analyze if code changes
npx gitnexus analyze

# Query specific flows
# Use GitNexus MCP tools with repo: "waoowaoo"
```
