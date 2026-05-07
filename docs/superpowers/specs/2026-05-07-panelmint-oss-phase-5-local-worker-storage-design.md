# PanelMint OSS Phase 5 Local Worker And Storage Design

Date: 2026-05-07
Status: Draft for review
Owner: Binhan

## 1. Mục tiêu

Phase 5 thay hai phụ thuộc cloud còn lại trong đường chạy chính:

- Bỏ Inngest khỏi queue/background job runtime.
- Bỏ Cloudflare R2 khỏi storage runtime.

Sau phase này, PanelMint OSS chạy local bằng Postgres, Next.js app, một worker process, WaveSpeed API key trong `.env`, và file ảnh local.

Một fresh local run nên dùng:

```bash
npm run dev
npm run worker
```

Không còn cần:

```bash
npm run inngest:dev
```

## 2. Baseline

Thiết kế này giả định Phase 4 đã xong:

- `WAVESPEED_API_KEY` trong `.env` là nguồn provider key duy nhất.
- App không còn DB-stored provider key.
- Settings không còn API key management.
- Billing/credits đã bị loại khỏi flow chính.

Baseline hiện tại vẫn còn:

- `src/lib/queue.ts` gửi event sang Inngest.
- `/api/inngest` serve Inngest functions.
- `pipeline_runs` còn field `inngestRunId`.
- README và `.env.example` vẫn nhắc Inngest/R2.
- `src/lib/storage.ts` còn R2 provider và local fallback.
- AWS SDK dependencies còn trong `package.json`.

## 3. Quyết định

- Queue dùng Postgres, không dùng Inngest.
- Worker chạy local bằng `npm run worker`.
- Queue jobs nằm trong bảng mới, ví dụ `pipeline_jobs`.
- Storage local-only.
- Thư mục storage dùng `PANELMINT_STORAGE_DIR`, mặc định `.panelmint/generated`.
- DB tiếp tục giữ các field `storageKey`, nhưng `storageKey` là relative key an toàn, không phải R2 key hay absolute file path.
- `/api/storage/...` tiếp tục tồn tại, nhưng serve file local thay vì redirect signed URL.
- Phase 5 bao gồm full R2/storage cleanup, không đẩy sang Phase 6.

## 4. Impact Notes

GitNexus impact analysis cho thấy các queue adapter có caller trực tiếp ít:

- `enqueueAnalyze`: LOW risk, caller chính là `src/app/api/generate/route.ts`.
- `enqueueStoryboard`: LOW risk, caller chính là approve-analysis route.
- `enqueueCharacterSheets`: LOW risk, caller chính là approve-analysis route.
- `enqueueImageGen`: LOW risk, caller chính là generate-images route và retry route.
- `cancelEpisodePipelineJobs`: LOW risk, caller chính là cancel route.

Storage có blast radius lớn hơn:

- `getStorage`: CRITICAL risk.
- Direct callers gồm reference image resolution, image download/save, và `/api/storage`.
- Affected flows gồm character sheet generation, panel image generation, reference image collection, and storage serving.

Implementation phải chia nhỏ queue replacement và storage cleanup, nhưng cả hai đều thuộc Phase 5.

## 5. Target Architecture

Next.js API routes vẫn là control plane:

- Tạo episode/project.
- Approve analysis.
- Approve storyboard.
- Queue image generation.
- Retry panel.
- Cancel generation.
- Đọc status/progress/result.

Thay đổi chính là các route không gọi Inngest nữa. Chúng ghi durable jobs vào Postgres.

Worker là execution plane:

- Claim job từ Postgres.
- Chạy handler tương ứng.
- Gọi lại business logic hiện có như `runAnalyzeStep`, `runStoryboardStep`, `runCharacterSheetStep`, `runImageGenStep`.
- Ghi success/failure vào job table và pipeline event tables.
- Retry job lỗi nếu còn attempts.
- Skip hoặc cancel job nếu episode đã bị cancel.

Storage local là asset plane:

- Generated images ghi vào `PANELMINT_STORAGE_DIR`.
- DB lưu relative `storageKey`.
- App serve ảnh qua `/api/storage/...`.
- Ảnh vẫn load sau khi app/worker restart.

## 6. Queue Contract

Thêm bảng DB mới, ví dụ `pipeline_jobs`.

Fields chính:

- `id`
- `episodeId`
- `userId`
- `type`
- `payload`
- `status`
- `attempts`
- `maxAttempts`
- `availableAt`
- `lockedAt`
- `lockedBy`
- `lastError`
- `dedupeKey`
- `createdAt`
- `updatedAt`

Status chính:

```text
queued
running
succeeded
failed
cancelled
```

Job types:

```text
analyze
storyboard
character-sheets-parent
character-sheet
image-generation-parent
image-panel
```

`dedupeKey` chống tạo job trùng. Ví dụ:

```text
analyze:<episodeId>
storyboard:<episodeId>
character-sheets-parent:<episodeId>
character-sheet:<episodeId>:<characterId>
image-generation-parent:<episodeId>:<panel-id-list-or-hash>
image-panel:<episodeId>:<panelId>:<attempt>
```

Khi enqueue cùng `dedupeKey` còn active, DB không tạo job mới ngoài ý muốn.

Active statuses nên gồm:

```text
queued
running
```

`failed`, `succeeded`, và `cancelled` không nên chặn retry có attempt mới.

## 7. Enqueue Design

`src/lib/queue.ts` vẫn là public queue API cho app routes.

Các hàm hiện tại được giữ tên để giảm churn:

- `enqueueAnalyze`
- `enqueueStoryboard`
- `enqueueCharacterSheets`
- `enqueueImageGen`
- `cancelEpisodePipelineJobs`

Nhưng implementation đổi sang DB:

- `enqueueAnalyze` tạo job `analyze`.
- `enqueueStoryboard` tạo job `storyboard`.
- `enqueueCharacterSheets` tạo job `character-sheets-parent`.
- `enqueueImageGen` tạo job `image-generation-parent` với danh sách panel ids.
- `cancelEpisodePipelineJobs` mark active jobs của episode thành `cancelled`.

Route code không cần biết worker chạy thế nào.

## 8. Worker Execution

Thêm script worker, ví dụ:

```bash
npm run worker
```

Worker loop:

1. Claim job `queued` có `availableAt <= now`.
2. Set job thành `running`, ghi `lockedAt`, `lockedBy`.
3. Chạy handler theo `type`.
4. Thành công thì set `succeeded`.
5. Lỗi thì retry hoặc set `failed`.
6. Sleep ngắn rồi lặp lại.

Worker phải xử lý stale jobs:

- Nếu job `running` quá lâu và `lockedAt` đã quá stale timeout, worker khác có thể claim lại.
- Stale timeout phải lớn hơn các bước dài như WaveSpeed polling.
- Image jobs cần idempotency ở panel status để tránh tạo lại panel đã xong.

Concurrency mặc định nên bảo thủ:

- Analyze/storyboard chạy tuần tự.
- Character sheet concurrency nhỏ, ví dụ 2 hoặc 3.
- Image panel concurrency nhỏ, ví dụ 2 hoặc 3.

Giá trị concurrency có thể cấu hình sau, nhưng Phase 5 không cần UI config.

## 9. Job Handlers

Handler mapping:

- `analyze`: gọi `runAnalyzeStep(payload)`.
- `storyboard`: gọi `runStoryboardStep(episodeId)`.
- `character-sheets-parent`: gọi `getCharacterSheetDispatchPayloads`, sau đó enqueue nhiều `character-sheet`.
- `character-sheet`: gọi `runCharacterSheetStep`.
- `image-generation-parent`: resolve panel fanout, sau đó enqueue nhiều `image-panel`.
- `image-panel`: render đúng một panel.

Implementation có thể gọi `runImageGenStep(episodeId, [panelId])` để giữ behavior hiện tại. Nếu việc đó làm khó idempotency hoặc status tổng, plan implementation có thể tách helper panel-level rõ hơn, nhưng không được rewrite pipeline không cần thiết.

## 10. Cancellation

Khi user cancel:

- API update episode sang `error`.
- API ghi pipeline event `cancelled`.
- Active jobs của episode chuyển sang `cancelled`.
- Panel còn `queued` chuyển sang `error`.

Worker phải kiểm tra cancellation:

- Trước khi chạy job.
- Trước khi ghi kết quả cuối của job dài.
- Trong image generation, nếu remote WaveSpeed request đã gửi thì không đảm bảo hủy remote được. Nhưng worker không được ghi kết quả thành công vào episode đã cancel.

Cancelled job không retry.

## 11. Retry

Retry panel phải tiếp tục hoạt động:

- Retry all failed panels hoặc retry panel ids cụ thể.
- Panel được retry chuyển về `queued`.
- Nếu retry panel đã `done` theo request cụ thể, API có thể xóa `imageUrl` và `storageKey` cũ trước khi queue lại.
- Job mới dùng `dedupeKey` có attempt mới để không bị chặn bởi failed old job.

Panel đã `done` không bị render lại khi chỉ chạy resume bình thường.

Character đã có `imageUrl` không bị tạo lại khi resume.

## 12. Local Storage Design

Storage local-only.

Env:

```text
PANELMINT_STORAGE_DIR=.panelmint/generated
```

Nếu không set, default là:

```text
<repo>/.panelmint/generated
```

`storageKey` là relative key, ví dụ:

```text
users/local-user/episodes/episode-1/panels/panel-1-uuid.png
characters/character-1-uuid.png
```

Không bao giờ lưu absolute path vào DB.

`LocalStorageProvider` chịu trách nhiệm:

- Normalize key.
- Chặn `..`.
- Chặn absolute path.
- Chặn path thoát khỏi storage dir.
- Tạo thư mục con khi upload.
- Ghi file với extension đúng.
- Delete file nếu cần.

`/api/storage/...` chịu trách nhiệm:

- Decode key.
- Validate path.
- Trả 404 nếu file không tồn tại.
- Trả file local trực tiếp hoặc stream file.
- Set `Content-Type`.
- Không redirect sang signed URL.

## 13. R2 Cleanup

Xóa khỏi runtime chính:

- `R2StorageProvider`.
- R2 env validation.
- R2 docs/copy.
- AWS SDK imports and dependencies.
- Logic chọn storage provider bằng `R2_ACCOUNT_ID`.

Xóa env khỏi `.env.example`:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`

README không còn nói R2 là production stack.

## 14. Inngest Cleanup

Xóa khỏi runtime chính:

- `src/lib/inngest/client.ts`
- `src/lib/inngest/functions.ts`
- `src/app/api/inngest/route.ts`
- `npm run inngest:dev`
- `inngest` dependency.
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `INNGEST_DEV`
- Inngest docs/copy.

`pipeline_runs.inngestRunId` không còn cần thiết. Phase 5 nên remove field này khỏi Prisma schema, baseline SQL, and fresh init migration.

Nếu implementation muốn giữ một generic external run id thì phải rename rõ ràng, nhưng mặc định là xóa.

## 15. Status And Health

Status UI nên tiếp tục dựa trên state hiện có:

- `episodes.status`
- `episodes.progress`
- `episodes.error`
- panel statuses
- `pipeline_runs`
- `pipeline_events`

Không cần rewrite UI lớn trong Phase 5.

Nếu worker không chạy:

- Jobs vẫn ở `queued`.
- UI vẫn thấy trạng thái đang chờ hoặc đang xử lý.
- README phải nói rõ cần chạy `npm run worker`.

Health endpoint nên phản ánh local runtime:

- Không check `INNGEST_*`.
- Không check `R2_*`.
- Có thể report queue summary đơn giản như queued/running/failed job count.
- Không bắt buộc phải detect chính xác worker process còn sống nếu chưa có heartbeat table.

Nếu thêm heartbeat đơn giản thì chỉ dùng để hiển thị, không làm app crash.

## 16. Error Handling

Job failure phải rõ ràng:

- Ghi `pipeline_jobs.lastError`.
- Ghi `pipeline_events`.
- Analyze/storyboard/provider setup lỗi thì update episode thành `error`.
- Panel image lỗi thì update panel thành `error`.
- Content filter vẫn giữ behavior riêng nếu hiện tại đang dùng `content_filtered`.
- Service/provider lỗi chung có thể fail episode nếu tiếp tục chạy panel khác không có nghĩa.

Retry delay nên đơn giản:

- Retry lần đầu sau delay ngắn.
- Sau đó tăng delay nhẹ.
- Hết `maxAttempts` thì `failed`.

Không cần distributed scheduler phức tạp trong v1.

## 17. Database Changes

Thêm model queue job.

Xóa hoặc cập nhật các artifact fresh schema:

- `prisma/schema.prisma`
- `prisma/postgres-baseline.sql`
- `prisma/migrations/20260330104038_init/migration.sql`

Queue table cần indexes cho claim nhanh:

- `(status, availableAt)`
- `(lockedAt)`
- `(episodeId)`
- unique hoặc partial unique cho active `dedupeKey` nếu Prisma/Postgres setup hỗ trợ rõ ràng.

Nếu partial unique index khó biểu diễn qua Prisma, implementation có thể dùng SQL migration/index thủ công trong baseline.

## 18. Documentation

README quickstart cần chuyển sang local OSS runtime:

```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma db push
npm run dev
npm run worker
```

Docs phải nói rõ:

- Worker cần chạy song song với dev server.
- Generated files nằm trong `PANELMINT_STORAGE_DIR`.
- Không commit `.panelmint/generated`.
- Xóa local generated files sẽ làm ảnh cũ không load dù DB còn record.
- Không cần Inngest.
- Không cần R2.

`.env.example` nên còn:

- `DATABASE_URL`
- `DIRECT_URL`
- `ALLOWED_ORIGINS`
- `WAVESPEED_API_KEY`
- `WAVESPEED_BASE_URL`
- model/rate limit options
- `PANELMINT_STORAGE_DIR`

## 19. Testing Strategy

Focused tests:

- `enqueue*` tạo DB job thay vì gọi Inngest.
- `dedupeKey` không tạo active duplicate jobs.
- Worker claim đúng job due.
- Worker không claim job locked còn hạn.
- Stale running job được reclaim.
- Job fail retry với delay.
- Hết retry thì set failed và ghi error.
- Cancel episode cancel active jobs.
- Worker skip cancelled episode.
- Retry image panel không duplicate panel `done`.
- Local storage ghi file dưới `PANELMINT_STORAGE_DIR`.
- `/api/storage/...` serve file local.
- `/api/storage/...` chặn path traversal.
- Env validation không check Inngest/R2.
- Health không report Inngest/R2 readiness.

Verification commands:

```bash
npm test
npm run build
rg -n "inngest|Inngest|INNGEST_|R2_|Cloudflare R2|@aws-sdk|s3-request-presigner|R2StorageProvider|inngest:dev" src prisma scripts README.md .env.example package.json
```

Final `rg` should return no active runtime, schema, script, package, env, or README matches. Historical specs and plans are allowed outside searched active paths.

Before committing implementation changes, run GitNexus change detection and confirm affected scope matches Phase 5 queue/storage replacement.

## 20. Non-Scope

Phase 5 should not:

- Add SQLite.
- Add multi-user support.
- Add local Stable Diffusion, ComfyUI, Ollama, or other local model runtimes.
- Add a hosted production deployment story.
- Add a queue dashboard UI.
- Add distributed multi-worker coordination beyond simple DB locking.
- Add cloud storage fallback.
- Add a new billing/credits system.

## 21. Definition Of Done

Phase 5 is done when:

- Comic generation works locally with `npm run dev` and `npm run worker`.
- Analyze, storyboard, character sheets, image generation, retry, cancel, status, reader/editor image loading still work.
- Inngest is gone from active runtime, package scripts, env docs, and dependencies.
- R2 is gone from active runtime, env docs, and dependencies.
- Generated images are stored under `PANELMINT_STORAGE_DIR`.
- Generated images survive app and worker restart.
- `/api/storage/...` safely serves local files.
- Worker can resume queued/stale jobs after restart.
- Failed jobs record useful errors.
- Tests and build pass.
