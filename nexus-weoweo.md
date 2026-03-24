# GitNexus Analysis: weoweo

> AI Comic Generator - Next.js 15 App Router
> Analyzed: 2026-03-23 | Commit: `1881176`

## Stats

| Metric | Count |
|--------|-------|
| Files | 93 |
| Symbols | 424 |
| Edges | 977 |
| Clusters | 40 |
| Flows | 30 |

## Functional Modules (Top 10)

| Module | Symbols | Cohesion |
|--------|---------|----------|
| **Pipeline** | 28 | 71% |
| **Components** | 10 | 100% |
| Cluster_10 | 7 | 82% |
| **App** | 7 | 100% |
| Cluster_31 | 7 | 94% |
| **Ai** | 7 | 74% |
| **Editor** | 7 | 100% |
| Cluster_1 | 6 | 91% |
| Cluster_8 | 6 | 91% |
| **Layout** | 5 | 100% |

## Key Execution Flows (Top 20 of 30)

| Flow | Steps | Type |
|------|-------|------|
| RunAnalyzeStep → InitKeys | 9 | cross_community |
| RunStoryboardStep → InitKeys | 9 | cross_community |
| RetryImages → InitKeys | 9 | cross_community |
| GeneratePageImage → InitKeys | 8 | cross_community |
| RunAnalyzeStep → IsRateLimitError | 7 | cross_community |
| RunStoryboardStep → IsRateLimitError | 7 | cross_community |
| RetryImages → IsRateLimitError | 7 | cross_community |
| GeneratePageImage → IsRateLimitError | 6 | cross_community |
| RunAnalyzeStep → CallLLMOpenAI | 5 | cross_community |
| RunAnalyzeStep → StripMarkdownFence | 5 | cross_community |
| RunAnalyzeStep → ExtractJsonSubstring | 5 | cross_community |
| RunStoryboardStep → CallLLMOpenAI | 5 | cross_community |
| RunStoryboardStep → StripMarkdownFence | 5 | cross_community |
| RunStoryboardStep → ExtractJsonSubstring | 5 | cross_community |
| StartPipelineWorker → DeriveEncryptionKey | 5 | cross_community |
| RetryImages → CallLLMOpenAI | 5 | cross_community |
| RetryImages → SaveBase64 | 5 | cross_community |
| RetryImages → DownloadAndSave | 5 | cross_community |
| RunImageGenStep → DeriveEncryptionKey | 4 | cross_community |
| StartPipelineWorker → IsEncrypted | 4 | cross_community |

## Architecture Summary

The codebase is organized around a **3-stage AI pipeline**:

1. **Analyze** (`RunAnalyzeStep`) — LLM-based script analysis
2. **Storyboard** (`RunStoryboardStep`) — Scene-by-scene storyboard generation
3. **Image Generation** (`GeneratePageImage`, `RetryImages`) — Multi-provider image rendering

Cross-cutting concerns:
- **API Key Management**: `InitKeys`, `DeriveEncryptionKey`, `IsEncrypted`
- **Error Handling**: `IsRateLimitError` flows for rate limit resilience
- **LLM Integration**: `CallLLMOpenAI`, `StripMarkdownFence`, `ExtractJsonSubstring`

## Usage

```bash
# Re-analyze if code changes
npx gitnexus analyze

# Query specific flows
# Use GitNexus MCP tools: query, context, impact, cypher
```
