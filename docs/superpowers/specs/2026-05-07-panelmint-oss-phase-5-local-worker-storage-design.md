# Thiết kế PanelMint OSS Phase 5: Local Worker Và Local Storage

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

## 4. Ghi chú tác động

GitNexus impact analysis cho thấy các queue adapter có caller trực tiếp ít:

- `enqueueAnalyze`: LOW risk, caller chính là `src/app/api/generate/route.ts`.
- `enqueueStoryboard`: LOW risk, caller chính là approve-analysis route.
- `enqueueCharacterSheets`: LOW risk, caller chính là approve-analysis route.
- `enqueueImageGen`: LOW risk, caller chính là generate-images route và retry route.
- `cancelEpisodePipelineJobs`: LOW risk, caller chính là cancel route.

Storage có blast radius lớn hơn:

- `getStorage`: CRITICAL risk.
- Direct callers gồm reference image resolution, image download/save, và `/api/storage`.
- Affected flows gồm character sheet generation, panel image generation, reference image collection, và storage serving.

Implementation phải chia nhỏ queue replacement và storage cleanup, nhưng cả hai đều thuộc Phase 5.

## 5. Kiến trúc mục tiêu

Next.js API routes vẫn là lớp nhận lệnh từ UI:

- Tạo episode/project.
- Approve analysis.
- Approve storyboard.
- Queue image generation.
- Retry panel.
- Cancel generation.
- Đọc status/progress/result.

Thay đổi chính là các route không gọi Inngest nữa. Chúng ghi durable jobs vào Postgres.

Worker là lớp xử lý nền:

- Claim job từ Postgres.
- Chạy handler tương ứng.
- Gọi lại business logic hiện có như `runAnalyzeStep`, `runStoryboardStep`, `runCharacterSheetStep`, `runImageGenStep`.
- Ghi success/failure vào job table và pipeline event tables.
- Retry job lỗi nếu còn attempts.
- Skip hoặc cancel job nếu episode đã bị cancel.

Storage local là lớp lưu file ảnh:

- Generated images ghi vào `PANELMINT_STORAGE_DIR`.
- DB lưu relative `storageKey`.
- App serve ảnh qua `/api/storage/...`.
- Ảnh vẫn load sau khi app/worker restart.

## 6. Hợp đồng queue

Thêm bảng DB mới, ví dụ `pipeline_jobs`.

Các field chính:

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

## 7. Thiết kế enqueue

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

## 8. Cách worker chạy

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

## 9. Hợp đồng claim job

Claim job phải là thao tác atomic trong DB. Không được claim bằng kiểu đọc job rồi update rời rạc.

Implementation nên dùng một trong hai cách:

- Raw SQL trong transaction với `FOR UPDATE SKIP LOCKED`.
- Hoặc một câu `UPDATE ... WHERE ... RETURNING *` có điều kiện status/lock đầy đủ.

Claim query phải chỉ lấy:

- Job `queued` có `availableAt <= now`.
- Hoặc job `running` đã stale theo `lockedAt`.

Khi claim thành công, cùng một thao tác DB phải set:

- `status = 'running'`
- `lockedAt = now`
- `lockedBy = <worker-id>`
- `attempts = attempts + 1`

Worker id nên được tạo khi process start, ví dụ `hostname:pid:uuid`.

Khi worker chạy concurrency nội bộ cho image/character jobs, mỗi lane vẫn phải claim qua cùng atomic claim contract. Điều này tránh hai lane lấy cùng một job.

Nếu Prisma không biểu diễn được `SKIP LOCKED` sạch, implementation được phép dùng `prisma.$queryRaw` hoặc `prisma.$executeRaw` cho riêng phần claim/reclaim.

## 10. Handler cho từng job

Mapping handler:

- `analyze`: gọi `runAnalyzeStep(payload)`.
- `storyboard`: gọi `runStoryboardStep(episodeId)`.
- `character-sheets-parent`: gọi `getCharacterSheetDispatchPayloads`, sau đó enqueue nhiều `character-sheet`.
- `character-sheet`: gọi `runCharacterSheetStep`.
- `image-generation-parent`: resolve panel fanout, sau đó enqueue nhiều `image-panel`.
- `image-panel`: render đúng một panel.

Implementation có thể gọi `runImageGenStep(episodeId, [panelId])` để giữ behavior hiện tại. Nếu việc đó làm khó idempotency hoặc status tổng, plan implementation có thể tách helper panel-level rõ hơn, nhưng không được rewrite pipeline không cần thiết.

Parent jobs là dispatch-only:

- `character-sheets-parent` enqueue các job `character-sheet`, rồi mark chính nó `succeeded`.
- `image-generation-parent` enqueue các job `image-panel`, rồi mark chính nó `succeeded`.
- Parent job không chờ child jobs chạy xong.

Aggregate completion dùng behavior hiện tại nếu giữ được:

- Mỗi `image-panel` gọi `runImageGenStep(episodeId, [panelId])`.
- Sau mỗi panel, `runImageGenStep` đọc global panel summary.
- Khi không còn panel cần render, episode được mark `done`.

Nếu implementation tách panel-level helper thay vì gọi `runImageGenStep`, plan phải thêm helper finalize rõ ràng, ví dụ `finalizeEpisodeImageGeneration(episodeId)`, và gọi helper đó sau mỗi child panel job.

Manual character sheet endpoint hiện tại vẫn là synchronous API path trong Phase 5:

- `src/app/api/characters/[characterId]/generate-sheet/route.ts` không cần chuyển sang queue trong phase này.
- Endpoint này vẫn phải dùng local storage contract mới.
- Endpoint này không được import R2/AWS SDK/Inngest.
- Tests của endpoint phải được update nếu image URL/storage key contract đổi.

## 11. Cancellation

Khi user cancel:

- API update episode sang `error`.
- API ghi pipeline event `cancelled`.
- Active jobs của episode chuyển sang `cancelled`.
- Panel còn `queued` chuyển sang `error`.
- UI hiện tại có thể vẫn thấy episode status là `error`, nhưng copy/status response nên có đủ event/error metadata để hiển thị là user-cancelled thay vì provider failure nếu UI đã có chỗ làm điều đó.

Worker phải kiểm tra cancellation:

- Trước khi chạy job.
- Trước khi ghi kết quả cuối của job dài.
- Trong image generation, nếu remote WaveSpeed request đã gửi thì không đảm bảo hủy remote được. Nhưng worker không được ghi kết quả thành công vào episode đã cancel.

Cancelled job không retry.

## 12. Retry

Retry panel phải tiếp tục hoạt động:

- Retry all failed panels hoặc retry panel ids cụ thể.
- Panel được retry chuyển về `queued`.
- Nếu retry panel đã `done` theo request cụ thể, API có thể xóa `imageUrl` và `storageKey` cũ trước khi queue lại.
- Job mới dùng `dedupeKey` có attempt mới để không bị chặn bởi failed old job.

Panel đã `done` không bị render lại khi chỉ chạy resume bình thường.

Character đã có `imageUrl` không bị tạo lại khi resume.

## 13. Thiết kế local storage

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

## 14. Hợp đồng image URL

`storageKey` là source of truth cho asset local.

Các field `imageUrl` hiện có vẫn được giữ để giảm UI/API churn, nhưng giá trị mới phải được derive từ `storageKey`:

```text
imageUrl = buildStorageProxyUrl(storageKey)
```

Với local storage mới, không được persist:

- Absolute local file path.
- `/generated/...`.
- R2 public URL.
- R2 signed URL.

Các nơi ghi ảnh mới, gồm panel image generation, character sheet generation, manual character sheet endpoint, và character appearance nếu có, phải ghi:

- `storageKey`: relative key an toàn.
- `imageUrl`: `/api/storage/...` URL được build từ `storageKey`.

Các API response có thể trả `imageUrl` từ DB để giữ UI đơn giản. Nếu implementation gặp row cũ có `storageKey` nhưng `imageUrl` thiếu hoặc stale, response layer nên ưu tiên derive URL từ `storageKey` thay vì trả URL cũ.

Phase 5 không cần migration phức tạp cho asset cũ trước OSS release, nhưng fresh generated assets sau Phase 5 phải dùng contract mới.

## 15. Hợp đồng reference image cho WaveSpeed

`/api/storage/...` là URL local để browser đọc ảnh. Không dùng URL này làm input reference image cho WaveSpeed, vì WaveSpeed cloud không truy cập được localhost/local file server của user.

Khi cần gửi character sheet hoặc reference image local cho WaveSpeed:

- Đọc file từ `PANELMINT_STORAGE_DIR` bằng `storageKey`.
- Upload file đó lên WaveSpeed Media Upload API bằng `WAVESPEED_API_KEY`.
- Dùng `data.download_url` trả về làm item trong `body.images`.

Đây là provider handoff tạm thời, không phải app storage mới:

- App vẫn lưu asset chính trong local storage.
- DB vẫn lưu `storageKey` local.
- Không lưu WaveSpeed media upload URL vào DB như source of truth.
- Không đưa R2 hoặc cloud storage fallback quay lại.

Nếu reference image thiếu file local, worker nên bỏ reference đó và tiếp tục với prompt-only/fallback model nếu flow hiện tại cho phép. Không được gửi `/api/storage/...`, `/generated/...`, hoặc absolute path vào WaveSpeed request body.

Implementation nên thêm helper riêng, ví dụ `prepareWaveSpeedReferenceImages`, để giữ logic này tách khỏi UI storage serving.

`LocalStorageProvider` chịu trách nhiệm:

- Normalize key.
- Chặn `..`.
- Chặn absolute path.
- Chặn path thoát khỏi storage dir.
- Tạo thư mục con khi upload.
- Ghi file với extension đúng.
- Delete file nếu cần.
- Chỉ cho phép extension ảnh hợp lệ: `png`, `jpg`, `jpeg`, `webp`, `gif`.
- Content type phải được map từ extension allowlist, không lấy tùy tiện từ user-controlled input.

`/api/storage/...` chịu trách nhiệm:

- Decode key.
- Validate path.
- Trả 404 nếu file không tồn tại.
- Trả file local trực tiếp hoặc stream file.
- Set `Content-Type`.
- Không redirect sang signed URL.

## 16. Dọn R2

Xóa khỏi runtime chính:

- `R2StorageProvider`.
- R2 env validation.
- R2 docs/copy.
- AWS SDK imports và dependencies.
- Logic chọn storage provider bằng `R2_ACCOUNT_ID`.

Xóa env khỏi `.env.example`:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`

README không còn nói R2 là production stack.

## 17. Dọn Inngest

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

`pipeline_runs.inngestRunId` không còn cần thiết. Phase 5 nên remove field này khỏi Prisma schema, baseline SQL, và fresh init migration.

Nếu implementation muốn giữ một generic external run id thì phải rename rõ ràng, nhưng mặc định là xóa.

## 18. Status và health

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

## 19. Xử lý lỗi

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

## 20. Thay đổi DB

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

## 21. Docs

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

## 22. Chiến lược test

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
- Reference images local được upload qua WaveSpeed Media Upload trước khi gửi vào `body.images`.
- WaveSpeed request body không bao giờ chứa `/api/storage/...`, `/generated/...`, hoặc absolute local path.
- Env validation không check Inngest/R2.
- Health không report Inngest/R2 readiness.
- Stale tests đang giả định Inngest/R2 phải được update hoặc delete.
- Các test hiện có như health route tests, env-validation tests, storage tests, image-gen runtime budget tests, route tests mock queue/Inngest, và image-gen flow tests phải được rà lại.

Verification commands:

```bash
npm test
npm run build
rg -n "inngest|Inngest|INNGEST_|R2_|Cloudflare R2|@aws-sdk|s3-request-presigner|R2StorageProvider|inngest:dev" src prisma scripts README.md .env.example package.json
```

Final `rg` should return no active runtime, schema, script, package, env, test, or README matches. Historical specs and plans are allowed outside searched active paths.

Before committing implementation changes, run GitNexus change detection and confirm affected scope matches Phase 5 queue/storage replacement.

## 23. Ngoài phạm vi

Phase 5 should not:

- Add SQLite.
- Add multi-user support.
- Add local Stable Diffusion, ComfyUI, Ollama, or other local model runtimes.
- Add a hosted production deployment story.
- Add a queue dashboard UI.
- Add distributed multi-worker coordination beyond simple DB locking.
- Add cloud storage fallback.
- Add a new billing/credits system.

## 24. Done khi

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
