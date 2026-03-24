ChatGPT Result


# Phân tích và giải pháp cho Weoweo Prompt Builder

## 1. Kết luận nhanh

Sau khi đọc `prompt_builder_comparison_report.md` và đối chiếu với code hiện tại của `weoweo`, em thấy report bắt rất đúng vấn đề cốt lõi: **Weoweo đang mất ngữ cảnh quan trọng khi đi từ truyện -> storyboard -> image prompt**, nên model ảnh phải tự đoán và dễ hallucinate.

Điểm quan trọng là: **Weoweo không cần copy nguyên Waoowaoo**. Cái cần là một bản "middle-ground" phù hợp MVP:

1. giữ pipeline đủ gọn để không đội cost quá mạnh,
2. nhưng truyền `source_text` và scene context xuống tận image prompt,
3. làm giàu character schema,
4. và thay bước final prompt rewrite bằng deterministic template/code.

Nếu làm đúng 4 việc này, chất lượng sẽ tăng mạnh hơn nhiều so với việc chỉ thêm nhiều LLM calls.

---

## 2. Những gì report nói đúng

### 2.1. Gap lớn nhất là fidelity, không phải chỉ là style

Report đúng ở điểm quan trọng nhất: prompt cuối của Weoweo hiện quá mỏng. Ở code hiện tại:

- `splitIntoPagesWithPanels()` sinh ra page + panel descriptions
- nhưng `buildPagePrompt()` trong `weoweo/src/lib/pipeline/image-gen.ts` chỉ dùng:
  - `panelDescriptions`
  - `panelCount`
  - `artStyle`
  - `characterDescriptions`

Nó **không truyền trực tiếp nguyên tác/page excerpt/panel source text** vào bước tạo prompt cuối. Khi source story không còn đi tới bước cuối, model ảnh rất dễ:

- tự thêm hành động không có trong truyện,
- đổi mood/tông cảnh,
- render nhân vật theo stereotype thay vì đúng narrative.

### 2.2. Character schema hiện còn quá mỏng cho comic fidelity

Hiện tại `analyzeCharactersAndLocations()` mới chuẩn hóa:

- `name`
- `aliases`
- `description`

Với comic/manga generation, chừng đó chưa đủ để khóa consistency. Thiếu các field như:

- `ageRange`
- `genderPresentation`
- `bodyBuild`
- `hair`
- `faceMarkers`
- `defaultOutfit`
- `visualKeywords`

Cho nên report đúng khi kết luận Weoweo đang thiếu neo để chống các lỗi kiểu:

- bé trai 12 tuổi bị vẽ thành người lớn,
- gender swap,
- outfit drift giữa các page,
- facial identity thay đổi thất thường.

### 2.3. Weoweo chưa có scene package đủ mạnh cho consistency

Hiện tại page/panel data chưa giữ các neo kiểu:

- mood
- atmosphere
- time of day
- weather
- lighting hint
- color hint
- composition intent

Khi mỗi page được prompt gần như độc lập, consistency toàn episode sẽ yếu hơn Waoowaoo là bình thường.

### 2.4. Prompt management inline là điểm yếu thật

Report đúng ở chỗ prompt đang nằm inline trong `weoweo/src/lib/ai/prompts.ts`. Điều này làm cho:

- khó kiểm thử từng template,
- dễ silent bug khi `.replace()` sai biến,
- khó review prompt diff,
- khó phát triển thành hệ thống có versioning.

---

## 3. Những điểm cần hiệu chỉnh sau khi đối chiếu với code hiện tại

Sau khi xem code, có 3 điểm mà em nghĩ nên điều chỉnh lại so với report để mình không over-engineer:

### 3.1. Weoweo đã có retry JSON cơ bản

Trong `weoweo/src/lib/pipeline/analyze.ts`, hiện đã có `callLLMWithJsonRetry()`:

- retry tối đa 3 lần,
- có bước sửa JSON bằng prompt repair,
- áp dụng cho `analyzeCharactersAndLocations()`
- và `splitIntoPagesWithPanels()`

Tức là gap về retry **không còn là "chưa có gì"**. Vấn đề thật sự là:

- retry này mới bảo vệ các bước trả JSON,
- chưa phải một policy thống nhất cho toàn pipeline,
- và chưa xử lý riêng các retryable error ở image/prompt stage.

### 3.2. Weoweo đã có character enhancement step

Trong `runAnalyzeStep()` của `weoweo/src/lib/pipeline/orchestrator.ts`, hiện đã có:

- `generateCharacterDescription()`
- `generateCharacterSheet()`

Đây là nền móng rất tốt. Vì vậy em **không khuyến nghị thêm ngay một character-visual LLM step mới** như Waoowaoo. Tốt hơn là:

- làm giàu schema upstream,
- sau đó tái sử dụng chính bước enhancement đang có.

### 3.3. Tổng số LLM calls thực tế của Weoweo không chỉ là "3 total"

Nếu nhìn theo code hiện tại, pipeline đang là:

1. `analyzeCharactersAndLocations()` -> 1 call
2. `generateCharacterDescription()` -> 1 call mỗi character
3. `splitIntoPagesWithPanels()` -> 1 call
4. `buildPagePrompt()` -> 1 call mỗi page

Nghĩa là chi phí thực tế không hoàn toàn rẻ như mô tả trong report. Điều này càng củng cố lý do nên **loại bỏ LLM rewrite ở final prompt builder**, vì đây là cost có thể cắt mà còn tăng fidelity.

---

## 4. Root cause thực sự

Theo em, lỗi chất lượng của Weoweo hiện tại đến từ 5 nguyên nhân chính:

### 4.1. `source_text` bị đứt mạch

`Page.content` có tồn tại, nhưng `Panel` chưa có `sourceText` hoặc `sourceExcerpt` riêng. Khi xuống tới image prompt, dữ liệu được rút còn "panel descriptions" nên mất neo narrative.

### 4.2. Final prompt builder đang là bước diễn giải tự do

`buildPagePrompt()` hiện gọi LLM để "viết lại" prompt cuối. Đây là điểm dễ sinh hallucination nhất, vì model đang được phép tái diễn giải scene thay vì chỉ render từ facts đã khóa.

### 4.3. Character canon chưa đủ structured

Description dạng text dài có ích, nhưng chưa đủ để enforce các thuộc tính phải giữ nguyên giữa nhiều page.

### 4.4. Không có scene-level context package

Thiếu `sceneContext` khiến mỗi page thiếu:

- mood chung,
- ánh sáng chung,
- palette chung,
- vị trí của page trong toàn arc.

### 4.5. Prompt system còn quá mềm

Inline string + `.replace()` giúp đi nhanh, nhưng đến giai đoạn tuning chất lượng thì nó trở thành nút thắt.

---

## 5. Giải pháp em khuyến nghị

## 5.1. Ưu tiên 1 - Làm ngay

### A. Truyền `sourceText` xuống panel-level

**Khuyến nghị:** không truyền full story vào mọi image prompt. Cách tốt hơn là:

- giữ **page-level `sceneContext`**
- và **panel-level `sourceText` excerpt**

Em đề xuất mỗi panel nên có thêm:

```ts
type PanelNarrativeAnchor = {
  sourceText: string
  mustKeep: string[]
}
```

`sourceText` nên là 1-3 câu gốc hoặc paraphrase rất gần của phần truyện mà panel đó đang minh họa.

`mustKeep` là danh sách facts không được đổi, ví dụ:

- `"quiet conversation, not combat"`
- `"boy is around 12 years old"`
- `"scene happens at dusk in the courtyard"`

**Vì sao panel-level tốt hơn page-level hoặc full story?**

- page-level vẫn hơi thô,
- full story quá dài và noisy,
- panel-level là mức neo tốt nhất giữa fidelity và token cost.

### B. Thay `buildPagePrompt()` từ LLM rewrite sang deterministic rendering

Đây là thay đổi có ROI cao nhất.

Thay vì:

1. đưa panel descriptions vào một prompt,
2. gọi LLM để viết lại prompt cuối,
3. rồi mới gửi cho image model,

hãy chuyển sang:

1. chuẩn hóa dữ liệu page/panel,
2. render prompt cuối bằng template code thuần,
3. gửi thẳng cho image model.

**Lý do:**

- giảm 1 lớp hallucination,
- giảm cost,
- dễ debug vì input -> output có thể truy vết,
- dễ enforce rules cứng.

`buildPagePrompt()` nên được đổi thành kiểu:

```ts
function renderPagePrompt(input: StructuredPagePromptInput): string
```

không gọi LLM ở trong nữa.

### C. Thêm faithfulness rules cứng vào final prompt

Prompt cuối nên có một block rules kiểu:

```text
Narrative source of truth:
- Use each panel's sourceText as the primary truth.
- If any visual instruction conflicts with sourceText, obey sourceText.
- Do not add actions, props, relationships, injuries, romance, or combat not supported by sourceText.
- Do not change a character's apparent age, gender presentation, body build, or key outfit markers.
- If a detail is ambiguous, stay neutral instead of inventing.
```

Đây là thứ Weoweo đang thiếu nhất để chặn những lỗi "AI tự bịa cảnh".

---

## 5.2. Ưu tiên 2 - Làm kế tiếp

### D. Nâng character schema lên mức đủ dùng cho comic

Em không nghĩ phải copy đủ 16 field của Waoowaoo ngay. Với comic MVP, subset này là đủ mạnh:

```ts
type CharacterProfile = {
  canonicalName: string
  aliases: string[]
  role: 'main' | 'supporting' | 'minor'
  ageRange: string
  genderPresentation: string
  bodyBuild: string
  hair: string
  faceMarkers: string[]
  defaultOutfit: string
  visualKeywords: string[]
  consistencyNotes: string[]
}
```

**Field cần ưu tiên nhất:**

1. `ageRange`
2. `genderPresentation`
3. `bodyBuild`
4. `hair`
5. `faceMarkers`
6. `defaultOutfit`
7. `visualKeywords`

Sau đó feed structured profile này vào bước `generateCharacterDescription()` đang có sẵn, thay vì tạo thêm hẳn một phase mới.

### E. Bổ sung `sceneContext` ở page-level

Mỗi page nên có thêm:

```ts
type PageSceneContext = {
  location: string
  timeOfDay: string
  weather?: string
  mood: string
  lightingHint: string
  colorHint: string
  pageRole: string
}
```

`pageRole` có thể là:

- setup
- transition
- reveal
- climax
- aftermath

Field này giúp image prompt hiểu page đang nằm ở đâu trong nhịp kể chuyện, từ đó mood nhất quán hơn.

### F. Tách prompt ra template files + validation tối giản

Em **không khuyến nghị bê nguyên hệ `prompt-i18n` của Waoowaoo** vào ngay, vì hơi nặng cho MVP.

Nhưng em **rất khuyến nghị một bản lite**:

- chuyển prompt ra file `.txt`
- có catalog object nhỏ
- có `renderPrompt(template, vars)`
- throw khi thiếu hoặc thừa biến

Ví dụ:

```ts
const PROMPT_CATALOG = {
  analyzeStory: ['story_text'],
  splitToPagesWithPanels: ['page_count', 'characters', 'story_text'],
  pageImagePrompt: ['style', 'scene_context', 'character_canon', 'panel_blocks'],
} as const
```

Lợi ích:

- prompt diff rõ ràng,
- không còn silent bug do `.replace()` sai,
- dễ test snapshot,
- đủ gọn cho MVP.

---

## 5.3. Ưu tiên 3 - Chỉ thêm khi cần

### G. Thêm `page visual brief` thay vì full cinematography phase

Nếu sau các bước trên mà chất lượng mood/lighting vẫn chưa đủ, em khuyến nghị **không nhảy thẳng lên mô hình 7+ calls kiểu Waoowaoo**.

Middle ground tốt hơn là thêm **1 optional LLM step cho từng page khó**:

```ts
type PageVisualBrief = {
  atmosphere: string
  compositionStrategy: string
  lightingPlan: string
  colorPalette: string
}
```

Step này chỉ bật cho:

- scene cảm xúc nặng,
- scene đông nhân vật,
- scene chuyển mood mạnh,
- hoặc page nào test run cho ra ảnh quá generic.

### H. Retry policy thống nhất cho các bước còn lại

Hiện retry mới tập trung ở JSON parse. Về sau nên tách thành helper chung:

- retryable: timeout, 429, transient parse failure
- non-retryable: schema mismatch nặng, invalid provider config

Nhưng em xếp việc này sau fidelity fixes, vì chất lượng đầu ra mới là pain lớn nhất lúc này.

---

## 6. Kiến trúc đề xuất cho Weoweo

## 6.1. Baseline mode khuyến nghị

Đây là mode em nghĩ hợp nhất cho MVP:

1. **Story analysis**  
   Trích xuất character profiles + locations + episode summary

2. **Storyboard split**  
   Sinh pages/panels với:
   - `sourceText`
   - `mustKeep`
   - `sceneContext`
   - `description`
   - `shotType`

3. **Character enhancement**  
   Tận dụng flow đang có để sinh mô tả visual chi tiết + character sheet

4. **Deterministic page prompt rendering**  
   Không dùng LLM để rewrite prompt cuối

5. **Image generation**

### Sweet spot về số LLM calls

Em khuyến nghị:

- giữ **2 global narrative LLM steps bắt buộc**
  - analyze
  - storyboard split
- giữ **character enhancement có chọn lọc**
- **bỏ mandatory page-prompt LLM rewrite**
- chỉ thêm **optional page visual brief** khi thật sự cần

Nói ngắn gọn: **sweet spot là 2 core calls + selective enhancement + optional HQ page brief**, chứ không phải 7+ calls/clip.

---

## 7. Gợi ý thay đổi cụ thể theo file

### `weoweo/src/lib/pipeline/analyze.ts`

Nên đổi schema output của `splitToPagesWithPanels()` để panel có thêm:

```ts
interface AnalyzedPanel {
  sourceText: string
  mustKeep: string[]
  description: string
  shotType: string
  characters: string[]
  location: string
  mood?: string
  lightingHint?: string
  composition?: string
}
```

Và page có thêm:

```ts
interface AnalyzedPage {
  summary: string
  content: string
  sceneContext: {
    location: string
    timeOfDay: string
    weather?: string
    mood: string
    lightingHint: string
    colorHint: string
    pageRole: string
  }
  characters: string[]
  location: string
  dialogue: { speaker: string; text: string }[]
  panels: AnalyzedPanel[]
}
```

### `weoweo/src/lib/pipeline/orchestrator.ts`

Khi save page/panel, nên persist thêm:

- `sceneContext`
- `sourceText`
- `mustKeep`
- `mood`
- `lightingHint`
- `composition`

Ngoài ra, vì pipeline hiện đã có bước review sau analysis/storyboard, đây là nơi rất hợp để user sửa:

- character canon
- page scene context
- panel must-keep facts

trước khi sinh ảnh.

### `weoweo/src/lib/pipeline/image-gen.ts`

Đây là file em khuyến nghị sửa mạnh nhất:

- bỏ `callLLM()` bên trong `buildPagePrompt()`
- đổi thành `renderPagePrompt()`
- input phải nhận:
  - character canon dạng structured
  - page scene context
  - panel sourceText
  - panel mustKeep
  - panel descriptions

### `weoweo/src/lib/ai/prompts.ts`

Nên tách thành:

- `src/lib/ai/prompt-templates/*.txt`
- `src/lib/ai/prompt-catalog.ts`
- `src/lib/ai/render-prompt.ts`

Chưa cần i18n ngay, nhưng nên có validation placeholder.

### `weoweo/prisma/schema.prisma`

Em khuyến nghị thêm các field text/json để giữ structured context:

```prisma
model Page {
  sceneContext String? // JSON
}

model Panel {
  sourceText   String?
  mustKeep     String? // JSON
  mood         String?
  lightingHint String?
  composition  String?
}

model Character {
  profileJson  String? // JSON
}
```

Giữ `description` hiện tại để backward compatible, còn `profileJson` sẽ là canon có cấu trúc hơn.

---

## 8. Mẫu prompt em khuyến nghị

## 8.1. Prompt mới cho `splitToPagesWithPanels`

Phần yêu cầu output nên thêm:

```text
For each page, also provide a sceneContext object with:
- location
- timeOfDay
- weather
- mood
- lightingHint
- colorHint
- pageRole

For each panel, provide:
- sourceText: the exact or near-exact story excerpt this panel visualizes
- mustKeep: array of factual constraints that must stay true
- description
- shotType
- characters
- location
- mood
- lightingHint
- composition

Rules:
- sourceText is the narrative source of truth for that panel
- do not invent actions, props, or relationships that are not supported by sourceText
- if a detail is uncertain, omit it instead of inventing it
```

## 8.2. Template cho final page image prompt

Final prompt nên được render từ code theo cấu trúc:

```text
Style:
{style}

Page layout:
Create one full comic page with {panel_count} panels in a readable manga layout.

Global scene context:
{scene_context}

Character canon:
{character_canon}

Panel instructions:
{panel_blocks}

Hard constraints:
- Use each panel's sourceText as the primary truth.
- If any panel description conflicts with sourceText, obey sourceText.
- Do not add combat, romance, injuries, props, or character interactions that are not supported by sourceText.
- Do not change character age, gender presentation, body build, hairstyle, or key outfit markers.
- Keep the page textless: no speech bubbles, no captions, no symbols, no letters.
```

---

## 9. Trade-off và rủi ro

### Rủi ro 1: Schema giàu hơn sẽ đòi migration và tuning

Đúng, nhưng đây là chi phí đáng trả vì nó biến prompt system từ "text blob" thành "structured controllable input".

### Rủi ro 2: Deterministic prompt builder có thể bớt "creative"

Đúng, nhưng với manga/comic từ source story thì ưu tiên đúng truyện hơn là sáng tạo tự do. Độ creative nên nằm ở image model, không nên nằm ở bước rewrite prompt.

### Rủi ro 3: Panel-level `sourceText` làm prompt dài hơn

Đúng, nên chỉ giữ excerpt ngắn 1-3 câu/panel và `mustKeep` thật cô đọng.

### Rủi ro 4: Multi-panel page generation tự thân nó vẫn khó

Ngay cả khi prompt tốt hơn, model ảnh vẫn có thể gặp khó ở layout nhiều panel. Nếu sau phase 1 mà layout còn yếu, đó là lúc mới nên cân nhắc:

- fallback cho page khó,
- hoặc panel-level generation + compositor cho selected pages.

Em không khuyến nghị làm việc này trước, nhưng nên giữ nó như phương án phase sau.

---

## 10. Kế hoạch triển khai em đề xuất

### Phase 1 - Tác động lớn nhất / effort hợp lý

1. thêm `sourceText` + `mustKeep` cho panel  
2. thêm `sceneContext` cho page  
3. thay `buildPagePrompt()` bằng deterministic renderer  
4. thêm hard faithfulness rules  

### Phase 2 - Ổn định và mở rộng

5. nâng character schema lên structured canon  
6. tách prompt ra template files + validation  
7. feed structured canon vào flow `generateCharacterDescription()` hiện tại  

### Phase 3 - Chỉ khi chất lượng vẫn chưa đủ

8. thêm optional `page visual brief` cho page khó  
9. chuẩn hóa retry/error classification cho toàn pipeline  
10. cân nhắc selective panel-level generation nếu multi-panel layout vẫn lỗi nhiều  

---

## 11. Recommendation cuối cùng

Nếu phải chốt một hướng ngắn gọn, em đề xuất:

> **Đừng clone Waoowaoo. Hãy giữ Weoweo gọn, nhưng làm cho dữ liệu đi xuyên suốt và final prompt trở nên deterministic.**

Thứ tự ưu tiên đúng là:

1. **source text propagation**
2. **character canon đủ mạnh**
3. **deterministic prompt rendering**
4. **faithfulness rules**
5. **scene context**

Đây là bộ thay đổi cho tỷ lệ "effort / chất lượng" tốt nhất với một MVP comic generator như Weoweo.


=============
Gemini Deep Think result

Chào anh, một bản báo cáo so sánh và Research Prompt cực kỳ xuất sắc. Anh đã xác định rất chính xác "điểm mù" của hệ thống Weoweo (MVP) khi đối chiếu với Waoowaoo (Production-ready). Vấn đề cốt lõi ở đây chính là **sự ảo giác (Hallucination) và mất bối cảnh (Context Loss)**.

Dựa trên triết lý **80/20 (bỏ ra 20% effort để đạt 80% chất lượng)** cùng các ràng buộc về Budget, Speed và Simplicity của anh, em xin đóng vai AI trả lời trực tiếp các câu hỏi nghiên cứu, cung cấp một "Blueprint" chi tiết để anh refactor ngay:

---

### 1. Danh sách cải tiến ưu tiên (Prioritized Improvements - High ROI)

Thay vì đẻ thêm LLM calls như Waoowaoo, chiến lược tốt nhất cho Weoweo là **Làm giàu dữ liệu nội tuyến (Inline Enrichment)** ở các bước hiện tại.

1. **🔥 Ưu tiên 1 (Critical): Source Text Anchoring & Strict Rules** - Ép LLM trích xuất `source_text` cho từng panel ở bước chia trang, và dùng nó làm "mỏ neo" tuyệt đối kèm Negative Prompt. (Khắc phục hoàn toàn bệnh AI tự bịa cảnh đánh nhau/yêu đương).
2. **🔥 Ưu tiên 2 (Critical): Core Character Demographics** - Bổ sung đúng 3 trường sống còn vào `analyzeStory`: `age_range`, `gender`, `visual_keywords`. (Khắc phục bệnh vẽ sai ngoại hình, trẻ con thành người lớn).
3. **🌟 Ưu tiên 3 (High): Inline Cinematography** - Gắn thẳng yêu cầu sinh `mood`, `lighting`, `shot_type` vào Bước chia Panel (Không tốn thêm LLM call).
4. **🛡️ Ưu tiên 4 (Medium): Lightweight Retry Wrapper** - Viết 1 hàm bọc gọi LLM tự động retry 3 lần. (Khắc phục 90% lỗi sập luồng do JSON parse hỏng).

---

### 2. Giải pháp chi tiết & Code/Prompt đi kèm

#### Q1 & Q2: Content Accuracy (Bám sát nguyên tác)

* **Cách pass `source_text` (Q1):** Truyền ở cấp độ **Per-panel** ngay trong Bước 2 (`splitToPagesWithPanels`). Việc truyền cả đoạn truyện dài vào prompt ảnh sẽ làm loãng thông tin, AI sinh ảnh sẽ không biết nên vẽ cảnh nào.
* **Luật Faithfulness (Q2):** Luật của Waoowaoo là tốt nhưng chưa đủ "đô" với các model sinh ảnh hiện đại. Anh cần **Negative Constraints (Luật cấm)** cực gắt.
* **Mẫu Prompt Sinh Ảnh:**
```text
[CRITICAL FAITHFULNESS RULES]
1. GROUND TRUTH: The "Source Text" is the absolute truth. The generated image MUST align perfectly with it.
2. NO HALLUCINATION: DO NOT add action, combat, magic, weapons, or romance UNLESS explicitly described in the Source Text. If the text describes a quiet conversation, the image MUST be peaceful and static.
3. CONFLICT RESOLUTION: If the visual description conflicts with the Source Text, ALWAYS prioritize the narrative logic of the Source Text.

```



#### Q3 & Q4: Character Accuracy (Chính xác nhân vật)

* **Trường thiết yếu (Q3):** Bỏ qua các trường rườm rà. Anh chỉ cần 3 trường cốt lõi: `age_range`, `gender`, `visual_keywords` (khoảng 10-15 từ tả tóc, mắt, form người, trang phục mặc định).
* **Visual Enhancement LLM (Q4):** **KHÔNG NÊN**. Đừng tạo thêm call. Hãy yêu cầu LLM tự nội suy `visual_keywords` ngay trong Bước 1.
* **Zod Schema cho Bước 1 (`analyzeStory`):**
```typescript
const CharacterSchema = z.object({
  name: z.string(),
  age_range: z.string().describe("e.g., '12-year-old', 'mid-20s adult', 'elderly'. CRITICAL for image gen."),
  gender: z.enum(["male", "female", "other", "unknown"]),
  visual_keywords: z.string().describe("Physical traits, hair, eye color, body type. Max 15 words.")
});

```



#### Q5 & Q6: Mood & Atmosphere (Không khí & Góc máy)

* **Cách tiếp cận (Q5):** Chọn **Option B (Inline in storyboard)**. Việc này rất rẻ và model Tier-1 (như GPT-4o, Claude 3.5 Sonnet) hoàn toàn làm tốt việc vừa chia panel vừa gán mood.
* **Tính nhất quán (Q6):** Chọn **Option A + D**. Sinh ra `global_scene_context` (time of day, weather) cho mỗi trang + Truyền dictionary nhân vật xuống.
* **Zod Schema cho Bước 2 (`splitToPagesWithPanels`):**
```typescript
const PanelSchema = z.object({
  panel_number: z.number(),
  source_text_english: z.string().describe("Translate the EXACT 1-2 original story sentences matching this panel to English."), // Dịch luôn ra TA để model ảnh dễ hiểu
  description: z.string().describe("Visual action description."),
  shot_type: z.string().describe("Camera angle (e.g., close-up, wide shot, over-the-shoulder)"),
  atmosphere_and_lighting: z.string().describe("Mood and lighting (e.g., tense dark shadows, peaceful bright morning)"),
  characters_in_panel: z.array(z.string()) // Chỉ định ai đang có mặt
});

```



#### Q7 & Q9: Architecture & Error Handling

* **Template Engine (Q7):** Hệ thống của Waoowaoo là Over-engineering cho MVP của anh. Chọn "Middle ground": Dùng 1 hàm helper TypeScript nhẹ nhàng để validate biến, tránh thay thế chuỗi bằng `.replace()` chay (dễ sinh silent bug).
```typescript
export function buildPrompt(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  const missing = result.match(/\{[a-zA-Z0-9_]+\}/g);
  if (missing) throw new Error(`Missing template variables: ${missing.join(', ')}`);
  return result;
}

```


* **Retry Logic (Q9):** **Bắt buộc phải có**. Đây là ROI cao nhất. Thêm hàm bọc với Exponential Backoff:
```typescript
export async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelay = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); } 
    catch (err) {
      if (i === retries - 1) throw err;
      const delay = baseDelay * Math.pow(2, i) + Math.random() * 500;
      console.warn(`LLM failed (JSON Parse/Rate Limit). Retrying ${i+1}/${retries} in ${Math.round(delay)}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}
// Sử dụng: await withRetry(() => generateObject({...}))

```



---

### 3. "Điểm ngọt" (Sweet Spot) cho số lượng LLM Calls (Q8)

Anh không cần 7+ calls, nhưng cũng không nên dùng 3 calls như hiện tại. Điểm ngọt là **2 LLM Text Calls + 1 Code Builder + Image Calls**. Bí quyết tiết kiệm chi phí/thời gian cực lớn ở đây là: **Bỏ hẳn LLM ở Bước 3**.

1. **Call 1 (LLM): `analyzeStory**` → Lấy Global Context + Characters (Đã làm giàu).
2. **Call 2 (LLM): `splitToPagesWithPanels**` → Chia storyboard, ép sinh inline mood, lighting, và `source_text`. *(Nên dùng model thông minh như GPT-4o / Claude 3.5 Sonnet)*.
3. **Step 3: `buildPagePrompt` (TypeScript Code - KHÔNG DÙNG LLM)** → Vì anh đã có JSON siêu xịn từ Bước 2 và Bước 1, anh chỉ cần dùng code TypeScript lặp qua mảng Panel, trích xuất nhân vật có trong `characters_in_panel`, nối chuỗi thành 1 text prompt chuẩn gửi cho Image Gen.
* *Lợi ích:* Code chạy tốn 0ms, giá $0, và quan trọng nhất là **chặn đứng 100% rủi ro LLM tự ảo giác** ở bước chuẩn bị prompt cuối cùng.


4. **Call 4: Image Gen** → Gọi OpenRouter/DashScope song song (Promise.all).

**Tổng thời gian dự kiến:** ~20-30s cho xử lý Text LLM + Thời gian Gen Image. Hoàn toàn thoả mãn target 2-5 phút!

---

### 4. Rủi ro & Trade-offs (Cần lưu ý)

| Quyết định / Cải tiến | Trade-off / Rủi ro | Cách giảm thiểu (Mitigation) |
| --- | --- | --- |
| **Gộp Cinematography & Source Text vào Bước 2** | Bắt LLM gánh quá nhiều việc có thể khiến model nhỏ (như Llama 8B, Haiku) bị ngợp, nhả JSON cắt cụt hoặc sai cấu trúc. | Bắt buộc dùng model **Tier 1 (GPT-4o / Claude 3.5 Sonnet)** riêng cho Bước 2. Bọc hàm `withRetry` cẩn thận. (Vì đã tiết kiệm được Bước 3 nên ngân sách hoàn toàn đáp ứng được). |
| **Bơm văn bản gốc tiếng Việt vào Image Prompt** | Các Image model phương Tây có thể bị nhiễu context hoặc không hiểu tiếng Việt. | Đã khắc phục ở Schema Bước 2: Yêu cầu LLM *"Translate the exact matching sentence to English"*. Vừa neo được logic nguyên tác, vừa chuẩn hóa ngôn ngữ. |
| **Token Limit của Image API** | Nhồi Character details, Source text, Rules, Camera vào prompt ảnh có thể bị API cắt cụt (thường max ~1000 chars). | Ở Bước 3 (Code), hãy nhớ filter chỉ đưa thông tin các nhân vật **đang xuất hiện** trong panel đó (`characters_in_panel`), đừng nhét toàn bộ Character Dictionary vào prompt. |

Với bản thiết kế nâng cấp này, hệ thống Weoweo của anh sẽ thu hẹp 80-90% khoảng cách chất lượng so với Waoowaoo mà vẫn duy trì được độ gọn nhẹ và tốc độ của một MVP!


=============
Claude Opus 4.6 Result (Code-Verified Analysis)

Em đã đọc kỹ report so sánh và **đọc trực tiếp toàn bộ source code** của Weoweo (orchestrator, analyze, image-gen, prompts, schema, LLM wrapper, character-design, API routes, rate-limiter, key-rotation...). Dưới đây là phân tích dựa trên code thực, không chỉ dựa trên report.

---

# Phân tích Weoweo Prompt Builder — Code-Verified

## 1. Đánh giá 2 bản phân tích trước (ChatGPT & Gemini)

### 1.1. Những điểm cả hai đều đúng

Cả ChatGPT và Gemini đều bắt chính xác 3 vấn đề cốt lõi:

1. **Source text bị đứt mạch** — Panel trong DB chỉ có `description`, `shotType`, `characters`, `location`. Không có trường nào giữ nguyên văn truyện gốc. Khi `generatePageImage()` gọi `buildPagePrompt()`, nó chỉ truyền `panelDescriptions[]` (lấy từ `approvedPrompt || description`) — hoàn toàn mất liên kết với narrative.

2. **Character schema quá mỏng** — Model `Character` trong Prisma chỉ có `name`, `aliases`, `description`, `imageUrl`. Hàm `analyzeCharactersAndLocations()` chỉ extract `{ name, aliases, description }`. Không có `ageRange`, `gender`, `bodyBuild`.

3. **Final prompt builder dùng LLM = thêm 1 lớp hallucination** — `buildPagePrompt()` trong `image-gen.ts` gọi `callLLM()` với temperature 0.6, yêu cầu LLM "viết lại" panel descriptions thành image prompt. Đây là nơi model dễ tự bịa thêm action/mood.

### 1.2. Những điểm ChatGPT bắt đúng mà Gemini bỏ qua

- **Weoweo đã có `callLLMWithJsonRetry()`**: 3 lần retry, có bước sửa JSON bằng LLM (temperature tăng 0.1/attempt). Report nói "Pray for valid JSON" là không chính xác — retry JSON **đã tồn tại** cho `analyzeCharactersAndLocations()` và `splitIntoPagesWithPanels()`.

- **Weoweo đã có character enhancement flow**: `generateCharacterDescription()` tạo mô tả visual 150-250 từ, `generateCharacterSheet()` tạo ảnh reference. Hai bước này chạy cho mỗi character trong `runAnalyzeStep()`. Gemini đề xuất "không nên thêm LLM step cho character" là đúng kết luận nhưng thiếu context là bước này **đã có sẵn**.

- **Tổng LLM calls thực tế**: ChatGPT đúng khi nói pipeline không chỉ "3 total":
  - 1 call: `analyzeCharactersAndLocations()`
  - N calls: `generateCharacterDescription()` × N characters
  - 1 call: `splitIntoPagesWithPanels()`
  - M calls: `buildPagePrompt()` × M pages (trong `generatePageImage()`)
  - Tổng: 2 + N + M calls (với 5 characters + 5 pages = ~12 LLM calls)

### 1.3. Những điểm Gemini bắt đúng mà ChatGPT bỏ qua

- **Dịch source text sang tiếng Anh** trong schema Bước 2 (`source_text_english`). Đây là insight thực tế rất quan trọng vì image model (Seedream, DashScope) hiểu tiếng Anh tốt hơn tiếng Việt rất nhiều. ChatGPT đề xuất truyền `sourceText` nhưng không nói rõ nên giữ tiếng Việt hay dịch.

- **Token limit của Image API** — Gemini đúng khi cảnh báo prompt image bị cắt cụt nếu nhồi quá nhiều context. Seedream qua OpenRouter và DashScope wanx2.1 đều có giới hạn prompt length.

### 1.4. Những điểm CẢ HAI đều thiếu hoặc sai

**a) Chưa phân tích multi-panel vs single-panel architecture:**

Cả hai đều nói về "per-panel" prompt nhưng không nhận ra: **Weoweo hiện tại generate 1 ảnh cho cả page (multi-panel layout)**. Code trong `runImageGenStep()`:

```typescript
// Groups approved panels by page
const pageGroups = groupPanelsByPage(approvedPanels)
for (const [pageId, panels] of pageGroups) {
    // Generates ONE image for all panels on this page
    const imageUrl = await generatePageImage({
        pageId,
        panelDescriptions: panels.map(p => p.approvedPrompt || p.description),
        panelCount: panels.length,
        ...
    })
}
```

Điều này có hệ quả lớn: khi truyền `sourceText` per-panel vào prompt cuối, tất cả sẽ được nhồi vào **1 prompt duy nhất** gửi cho image API. Với 5-7 panels/page, prompt sẽ rất dài.

**b) Chưa đề cập hệ thống key rotation:**

Weoweo có `KeyRotation` class quản lý nhiều Google AI API keys, cooldown 60s khi bị rate limit. Đây là cơ sở hạ tầng tốt mà cả hai report bỏ qua.

**c) Chưa đề cập two-stage approval process:**

Pipeline có 2 điểm dừng cho user review:
1. `review_analysis` — user sửa character descriptions + locations
2. `review_storyboard` — user sửa panel descriptions (đặt `approvedPrompt`)

Đây là **điểm mạnh quan trọng** vì user có thể chỉnh `sourceText`/`mustKeep` ở đây trước khi sinh ảnh. ChatGPT nhắc thoáng nhưng không phân tích sâu.

**d) Chưa đề cập reference image system:**

`generatePageImage()` truyền `referenceImages[]` (character sheet URLs) vào prompt. Image API được instruction: "Reference images show exact appearance, maintain consistency". Đây đã là một dạng character consistency enforcement — chưa hoàn hảo nhưng không phải "zero" như report ngụ ý.

**e) `buildPagePrompt` không hoàn toàn xấu:**

Cả hai đều khuyên bỏ hẳn LLM ở bước này. Nhưng xem kỹ prompt, bước này đang làm một việc có giá trị: **compose multi-panel layout description**. Nó quyết định panel nào lớn/nhỏ, bố cục tổng thể, flow thị giác. Deterministic template **không thể làm tốt việc này** vì layout decision phụ thuộc vào nội dung dramatic từng panel.

---

## 2. Root cause analysis (bổ sung)

Ngoài 5 root cause mà ChatGPT đã nêu, em thấy thêm 2 nguyên nhân từ code:

### 2.1. `splitIntoPagesWithPanels()` prompt quá generic về panel output

Prompt hiện tại yêu cầu panel có:
```
{ description, shotType, characters[], location }
```

Nhưng `description` là trường tự do — LLM có thể viết bất kỳ điều gì. Không có ràng buộc nào buộc `description` phải bám sát nguyên văn truyện. Đây là nơi hallucination bắt đầu — **trước cả bước `buildPagePrompt()`**.

### 2.2. Character description quá narrative, thiếu structured identity

`generateCharacterDescription()` tạo ra 1 đoạn văn 150-250 từ dạng "A young boy with..." — rất giàu chi tiết nhưng khi được nhồi vào image prompt, thông tin quan trọng (tuổi, giới tính) bị chìm trong text dài. Image model có thể bỏ qua "12-year-old" ở giữa đoạn 200 từ.

---

## 3. Giải pháp em khuyến nghị

### Nguyên tắc chủ đạo

> **Không bỏ LLM ở `buildPagePrompt()`. Thay vào đó, biến nó từ "creative rewrite" thành "constrained composition" bằng cách truyền data giàu hơn + rules gắt hơn.**

Lý do em KHÔNG đồng ý bỏ hoàn toàn LLM ở bước cuối:

1. **Multi-panel layout composition cần intelligence** — quyết định panel nào lớn/nhỏ, dramatic emphasis, flow đọc. Template code thuần sẽ tạo layout cơ học, thiếu narrative awareness.

2. **Image prompt cần ngôn ngữ tự nhiên** — Seedream/DashScope respond tốt nhất với prose description, không phải structured data dump. LLM bridge JSON → natural prompt tốt hơn code.

3. **Vấn đề không phải ở việc dùng LLM mà ở việc LLM thiếu constraints** — Nếu LLM nhận đủ `sourceText` + `mustKeep` + `characterCanon` + faithfulness rules, nó sẽ viết prompt chính xác thay vì bịa.

### 3.1. Ưu tiên 1 — Source Text Anchoring (ROI cao nhất)

**Thay đổi `splitIntoPagesWithPanels()` schema:**

```typescript
// Thêm vào prompt của splitToPagesWithPanels
const ENHANCED_PANEL_SCHEMA = `
For each panel, provide:
- sourceExcerpt: translate the EXACT 1-3 original story sentences
  this panel visualizes into English. This is the narrative anchor.
- mustKeep: array of 2-4 factual constraints that MUST remain true
  in the final image (e.g., "boy is 12 years old", "peaceful indoor scene",
  "no weapons present")
- description: visual action description (what the reader sees)
- shotType: camera angle
- characters: array of character names present
- location: where this happens
- mood: emotional tone (e.g., "tense", "peaceful", "melancholic")
- lighting: light description (e.g., "warm afternoon sunlight", "dim candlelight")

CRITICAL RULES:
- sourceExcerpt must be a faithful translation, not a creative reinterpretation
- mustKeep must include constraints that PREVENT common hallucinations
  (e.g., if scene is quiet, include "no combat, no weapons")
- description must be consistent with sourceExcerpt — if they conflict,
  rewrite description to match sourceExcerpt
`
```

**DB migration:**

```prisma
model Panel {
  // ... existing fields ...
  sourceExcerpt  String?   // English translation of source text for this panel
  mustKeep       String?   // JSON array of factual constraints
  mood           String?
  lighting       String?
}

model Page {
  // ... existing fields ...
  sceneContext    String?   // JSON: { timeOfDay, weather, mood, colorTone }
}
```

### 3.2. Ưu tiên 2 — Character Identity Anchoring

**Thêm structured identity vào `analyzeCharactersAndLocations()` schema:**

```typescript
// Thêm vào prompt của analyzeCharactersAndLocations
const ENHANCED_CHARACTER_SCHEMA = `
For each character, provide:
- name: canonical name
- aliases: array of other names/nicknames
- description: physical appearance in detail
- identityAnchor: {
    ageRange: string (e.g., "12-year-old boy", "mid-30s woman")
    gender: "male" | "female" | "other"
    bodyBuild: string (e.g., "slim child", "tall muscular")
    hairSignature: string (e.g., "short black spiky hair")
    faceSignature: string (e.g., "round childish face, big brown eyes")
    outfitDefault: string (e.g., "blue school uniform, white sneakers")
  }
`
```

**DB migration:**

```prisma
model Character {
  // ... existing fields ...
  identityJson   String?   // JSON: { ageRange, gender, bodyBuild, ... }
}
```

**Cách sử dụng trong `buildPagePrompt()`:**

Khi build character canon cho image prompt, extract identity anchor thành dòng đầu tiên:

```typescript
function formatCharacterCanon(characters: Character[]): string {
  return characters.map(c => {
    const identity = c.identityJson ? JSON.parse(c.identityJson) : null
    const anchor = identity
      ? `[${identity.ageRange}, ${identity.gender}, ${identity.bodyBuild}]`
      : ''
    // Identity anchor đứng đầu để image model đọc đầu tiên
    return `${c.name} ${anchor}: ${c.description}`
  }).join('\n\n')
}
```

### 3.3. Ưu tiên 3 — Constrained `buildPagePrompt()` (KHÔNG bỏ LLM, thêm guardrails)

**Thay đổi prompt `PROMPTS.buildPageImagePrompt`:**

```text
You are a comic page compositor. Your job is to take STRUCTURED panel data
and compose it into a single coherent image prompt for a multi-panel manga page.

Art style: {style}
Number of panels: {panel_count}

== CHARACTER CANON (maintain these appearances EXACTLY) ==
{character_canon}

== PAGE SCENE CONTEXT ==
{scene_context}

== PANEL DATA ==
{enriched_panel_blocks}

== COMPOSITION TASK ==
Design a dynamic {panel_count}-panel manga page layout. For each panel:
1. Use the sourceExcerpt as your PRIMARY reference for what happens
2. Use description for visual composition guidance
3. Respect mustKeep constraints — these are NON-NEGOTIABLE
4. Match mood and lighting from panel data
5. Vary panel sizes based on dramatic weight

== HARD CONSTRAINTS ==
- NEVER add combat, weapons, magic, romance, or injuries NOT in sourceExcerpt
- NEVER change a character's age, gender, body build, or hair from CHARACTER CANON
- If description conflicts with sourceExcerpt, OBEY sourceExcerpt
- If unsure about a detail, describe it neutrally rather than inventing
- ZERO text: no speech bubbles, no captions, no letters, no symbols
- Output in English, max 500 words
```

**Cách build `enriched_panel_blocks`:**

```typescript
function buildEnrichedPanelBlocks(panels: EnrichedPanel[]): string {
  return panels.map((p, i) => {
    const mustKeep = p.mustKeep ? JSON.parse(p.mustKeep) : []
    return [
      `--- Panel ${i + 1} (${p.shotType || 'medium'}) ---`,
      `Source excerpt: "${p.sourceExcerpt || 'N/A'}"`,
      `Must keep: ${mustKeep.length > 0 ? mustKeep.join('; ') : 'none'}`,
      `Visual: ${p.approvedPrompt || p.description}`,
      `Characters: ${p.characters || 'none'}`,
      `Mood: ${p.mood || 'neutral'} | Lighting: ${p.lighting || 'natural'}`,
    ].join('\n')
  }).join('\n\n')
}
```

### 3.4. Ưu tiên 4 — Scene Context cho Page

**Thêm `sceneContext` vào `splitIntoPagesWithPanels()` output:**

```typescript
// Thêm vào yêu cầu output trong prompt
`For each page, also provide:
- sceneContext: {
    timeOfDay: string (morning/afternoon/evening/night)
    weather: string (clear/rainy/cloudy/...)
    dominantMood: string (peaceful/tense/joyful/melancholic/...)
    colorTone: string (warm golden/cool blue/muted grey/...)
    pageRole: string (setup/rising/climax/falling/resolution)
  }`
```

`colorTone` đặc biệt hữu ích vì nó tạo visual consistency giữa các panel trên cùng page.

### 3.5. Ưu tiên 5 — Prompt token budget management

Vì Weoweo gen 1 ảnh/page (multi-panel), prompt cuối sẽ dài. Cần budget:

```typescript
const MAX_PROMPT_CHARS = 1500 // Seedream/DashScope safe limit

function trimPromptToBudget(prompt: string, maxChars: number): string {
  if (prompt.length <= maxChars) return prompt

  // Ưu tiên giữ: style + character canon + hard constraints
  // Cắt: panel details dài nhất
  // ... truncation logic ...
}
```

Gemini đúng khi nhắc risk này nhưng chưa cho giải pháp cụ thể. Cách tốt nhất:
- Character canon chỉ include characters **xuất hiện trên page đó** (filter bằng `characters_in_panel`)
- `sourceExcerpt` giới hạn 1-2 câu/panel (đã dịch sang EN nên ngắn hơn)
- `mustKeep` tối đa 3-4 items/panel, mỗi item tối đa 10 từ

---

## 4. Điểm khác biệt với ChatGPT và Gemini

| Khía cạnh | ChatGPT | Gemini | Em (Claude) |
|-----------|---------|--------|-------------|
| **Bỏ LLM ở `buildPagePrompt()`?** | Bỏ hoàn toàn → deterministic | Bỏ hoàn toàn → code builder | **Giữ LLM nhưng thêm constraints gắt** |
| **Character schema** | 11 fields (quá nhiều cho MVP) | 3 fields (quá ít) | **6 fields trong `identityAnchor`** — đủ anchor mà không quá nặng |
| **Source text language** | Không đề cập | Dịch sang English | **Dịch sang English** — đồng ý với Gemini |
| **Multi-panel awareness** | Không nhận ra | Không nhận ra | **Phân tích kỹ** — ảnh hưởng lớn đến token budget |
| **Retry assessment** | Đã có cơ bản | Cần thêm | **Đã đủ cho MVP** — `callLLMWithJsonRetry` + key rotation đã cover 90% cases |
| **Reference images** | Không đề cập | Không đề cập | **Đã có và hoạt động** — cần tận dụng, không cần build thêm |
| **Sweet spot LLM calls** | 2 core + selective | 2 + code + image | **Giữ nguyên flow hiện tại** (2 + N + M) nhưng enrich data quality |

---

## 5. Vì sao em KHÔNG khuyên bỏ LLM ở bước cuối

Đây là điểm em khác biệt lớn nhất với cả hai phân tích trước.

### Argument "bỏ LLM":
- Deterministic = không hallucinate
- Rẻ hơn (0$ vs ~$0.001/call)
- Debug dễ hơn

### Counter-argument (em):

**1. Image model cần prose, không cần structured dump.**

Prompt dạng:
```
Panel 1 (wide): sourceExcerpt: "..." mustKeep: [...] Visual: "..."
Characters: "..." Mood: "..."
```
sẽ cho kết quả kém hơn nhiều so với:
```
A wide establishing shot of a dimly lit courtyard at dusk. A 12-year-old
boy with short black hair sits on stone steps, talking quietly with an
elderly monk. The mood is contemplative, warm amber light from paper
lanterns...
```

Image model (Seedream, DALL-E, Midjourney, Flux) đều được train trên natural language descriptions, không phải JSON.

**2. Layout composition cần narrative intelligence.**

Quyết định "panel 3 nên lớn gấp đôi vì đây là climax moment" cần hiểu dramatic weight — deterministic code không làm được điều này mà không trở thành rule engine phức tạp.

**3. Vấn đề thực sự là input thiếu, không phải LLM thừa.**

Khi LLM nhận đủ:
- `sourceExcerpt` (neo narrative)
- `mustKeep` (ràng buộc cứng)
- `characterCanon` với identity anchor (neo ngoại hình)
- Faithfulness rules (luật cấm)

thì output sẽ bị "ép" vào corridor chính xác. Hallucination xảy ra vì **input hiện tại quá mỏng**, không phải vì bản chất dùng LLM.

**4. Fallback plan:**

Nếu sau khi thêm đủ data + rules mà LLM vẫn hallucinate ở bước cuối, lúc đó mới chuyển sang deterministic. Nhưng thử cách ít disruptive trước.

---

## 6. Kế hoạch triển khai

### Phase 1 — Data Enrichment (impact cao nhất, effort vừa)

1. **Migration**: thêm `sourceExcerpt`, `mustKeep`, `mood`, `lighting` cho Panel; `sceneContext` cho Page; `identityJson` cho Character
2. **Sửa prompt `analyzeCharactersAndLocations`**: thêm `identityAnchor` vào output schema
3. **Sửa prompt `splitToPagesWithPanels`**: thêm `sourceExcerpt`, `mustKeep`, `mood`, `lighting`, `sceneContext` vào output schema
4. **Sửa `runStoryboardStep()`**: persist các field mới vào DB
5. **Sửa `buildPagePrompt()` prompt**: thêm enriched panel blocks + character canon + faithfulness rules

### Phase 2 — Fine-tuning (sau khi test Phase 1)

6. **Token budget management**: trim prompt khi vượt limit
7. **Character canon formatting**: identity anchor đứng đầu, chỉ include characters trên page
8. **Prompt validation lite**: `renderPrompt()` helper throw khi thiếu biến

### Phase 3 — Chỉ khi cần

9. **Tách prompt ra `.txt` files** — khi số prompt > 5
10. **Optional page visual brief** — LLM step riêng cho scene khó
11. **Deterministic fallback** — nếu Phase 1+2 không đủ giải quyết hallucination

---

## 7. Tổng kết

### Điểm chung 3 phân tích đều thống nhất:
- Source text PHẢI đi xuyên suốt pipeline
- Character schema PHẢI có ít nhất age + gender
- Faithfulness rules cứng là bắt buộc
- Không nên copy nguyên Waoowaoo

### Điểm khác biệt quan trọng nhất của em:
- **Giữ LLM ở bước cuối** nhưng thêm constraints — thay vì bỏ hoàn toàn
- **Nhận diện multi-panel architecture** ảnh hưởng token budget
- **Tận dụng reference image system đang có** thay vì build thêm
- **Retry/key rotation đã đủ** cho MVP — không cần thêm
- **6 identity fields** là sweet spot (không phải 3 như Gemini, không phải 11 như ChatGPT)

### Recommendation cuối cùng:

> **Đừng refactor architecture. Hãy enrich data và tighten constraints. Pipeline hiện tại của Weoweo có kiến trúc đúng (analyze → storyboard → compose → image), vấn đề là data đi qua pipeline quá mỏng và bước compose thiếu guardrails. Thêm `sourceExcerpt` + `identityAnchor` + faithfulness rules sẽ giải quyết 80% vấn đề chất lượng mà không cần thay đổi flow.**


==========
Final verdict: 
Chào anh, với tư cách là một Tech Lead / System Architect audit lại toàn bộ 3 bản phân tích trên, em xin đưa ra **Phán quyết cuối cùng (Final Verdict)**:

🏆 **Bản phân tích của Claude Opus 4.6 là xuất sắc, sâu sát và mang tính thực tiễn cao nhất.**

Cả ChatGPT và Gemini đều đưa ra những lời khuyên rất chuẩn mực về mặt lý thuyết xây dựng hệ thống AI Agent chung. Tuy nhiên, chúng đã mắc **một sai lầm chí mạng do đọc lướt code**: Không nhận ra hệ thống Weoweo của anh đang **generate 1 ảnh cho toàn bộ 1 trang (Multi-panel layout)** thay vì 1 ảnh cho từng panel riêng lẻ như hệ thống Waoowaoo.

Sự khác biệt vật lý này làm thay đổi toàn bộ chiến lược thiết kế prompt. Dưới đây là bản **Audit chốt hạ**, giúp anh phân xử các mâu thuẫn giữa 3 AI và cung cấp một "Golden Blueprint" duy nhất để anh gõ code ngay hôm nay.

---

### 1. Phán xử mâu thuẫn lớn nhất: Có nên vứt bỏ LLM ở bước cuối (`buildPagePrompt`)?

* **ChatGPT & Gemini:** Xúi anh vứt bỏ LLM, chuyển sang dùng code thuần (Deterministic Template) nối chuỗi ghép prompt để tiết kiệm tiền và chặn đứng 100% ảo giác (hallucination).
* **Claude:** Khuyên **GIỮ LẠI LLM**, nhưng trói nó bằng "vòng kim cô" (Hard Constraints) và mớm cho nó Data giàu hơn.
* **👉 Quyết định của Auditor: Nghe theo Claude 100%. BẮT BUỘC PHẢI GIỮ LLM.**

**Lý do thực tiễn:** Vì anh đang làm **Multi-panel layout** (1 ảnh chứa 4-5 khung tranh). Các model sinh ảnh (Seedream, Midjourney, DashScope) được train trên **văn xuôi miêu tả (prose)**. Nếu anh dùng code nối chuỗi thô cứng kiểu: `[Panel 1: tả cảnh A] \n [Panel 2: tả cảnh B]`, model ảnh sẽ không hiểu cách phân bổ không gian, các khung hình sẽ hòa vào nhau, hoặc nó sẽ lờ đi các panel ở cuối.

Anh CẦN LLM ở bước cuối đóng vai trò **"Đạo diễn dàn trang" (Compositor)** để đọc đống JSON khô khan và viết lại thành một đoạn văn miêu tả bố cục mạch lạc (VD: *"A dynamic manga page. The top wide panel establishes the scene... The bottom vertical panel focuses on..."*). Thuốc giải cho chứng ảo giác không phải là giết chết LLM, mà là cung cấp đủ "luật cấm" cho nó.

---

### 2. Tổng hợp "Golden Blueprint" (The 80/20 Sweet Spot)

Anh không cần đập đi xây lại kiến trúc 7 bước cồng kềnh như Waoowaoo. Hãy giữ nguyên flow hiện tại của Weoweo (rất thông minh cho MVP) và chỉ làm đúng 3 việc sau:

#### Bước 1: Mở rộng đường ống dữ liệu (Prisma Schema)

Gom các field tối ưu nhất từ Claude (6 trường cốt lõi) và ChatGPT (Scene Context):

```prisma
model Character {
  // ... fields hiện tại
  // Dùng 6 trường "Điểm ngọt" của Claude, đủ để neo ngoại hình mà không làm tràn Token:
  identityJson   String? // JSON: { ageRange, gender, bodyBuild, hairSignature, faceSignature, outfitDefault }
}

model Page {
  // ... fields hiện tại
  sceneContext   String? // JSON: { timeOfDay, weather, dominantMood, colorTone }
}

model Panel {
  // ... fields hiện tại
  // KẾT HỢP CẢ 3 MODEL: Mỏ neo nguyên tác (BẮT BUỘC DỊCH SANG TIẾNG ANH như Gemini gợi ý)
  sourceExcerpt  String? // Tiếng Anh: 1-2 câu truyện gốc neo cho panel này.
  mustKeep       String? // JSON Array (VD: ["peaceful", "no weapons", "boy is crying"])
  mood           String?
  lighting       String?
}

```

#### Bước 2: Nâng cấp Zod/JSON Schema ở 2 bước đầu

* **Tại `analyzeCharactersAndLocations`:** Ép LLM trả thêm object `identityAnchor` (chứa 6 trường như schema trên) cho mỗi nhân vật.
* **Tại `splitToPagesWithPanels`:** Bắt LLM trả về `sceneContext` cho Page. Đặc biệt, với mỗi Panel, ép nó **trích xuất và dịch 1-2 câu nguyên tác sang tiếng Anh** (`sourceExcerpt`) cùng danh sách `mustKeep` (tối đa 3 constraints).

#### Bước 3: Đổi System Prompt của `buildPagePrompt` thành "Hợp đồng pháp lý"

Giữ nguyên hàm gọi LLM tạo prompt ảnh, hạ `temperature` xuống thật thấp (`0.1` hoặc `0.2`), và truyền prompt theo cấu trúc gắt gao sau:

```text
You are an expert Manga Page Compositor. Combine the structured data below into ONE cohesive, natural-language, flowing image prompt for a {panel_count}-panel layout.

== GLOBAL SCENE CONTEXT ==
{scene_context}

== CHARACTER IDENTITY ANCHORS ==
{filtered_character_canon} 

== PANEL DATA ==
{enriched_panel_blocks} // Chứa sourceExcerpt, mustKeep và description

== CRITICAL LAWS (NON-NEGOTIABLE) ==
1. ABSOLUTE TRUTH: "sourceExcerpt" is the ultimate narrative truth. If a "description" conflicts with it, rewrite the description to match the excerpt.
2. ZERO HALLUCINATION: DO NOT add combat, weapons, magic, romance, or injuries UNLESS explicitly stated in the sourceExcerpt. Keep static scenes static!
3. STRICT ANCHORS: You MUST enforce every rule in the mustKeep arrays. Never alter a character's age, gender, or core outfit.
4. NO TEXT: Do not include speech bubbles, text, words, or sound effects.

Output ONLY the English descriptive prompt (Max 1500 characters). Focus on dynamic panel sizing, layout flow, and lighting.

```

---

### 3. "Value-Add" từ Auditor: 2 quả bom nổ chậm anh CẦN TRÁNH khi Code

Dù anh áp dụng Blueprint trên, khi gõ code thực tế anh sẽ đụng 2 rủi ro vật lý này:

**💣 Bom 1: Vượt quá Token Limit của Image API (Cực kỳ nguy hiểm)**

* *Vấn đề:* Gom 5-7 panels + Nguyên văn truyện + Nhân vật vào 1 prompt sẽ rất dễ vượt quá giới hạn token của Seedream hay Wanx. Nếu API cắt cụt prompt, nó sẽ cắt mất phần `CRITICAL LAWS` ở cuối -> AI lại ảo giác.
* *Cách fix bằng Code TS:* Ở bước chuẩn bị biến `{filtered_character_canon}`, anh **CHỈ dùng `.filter()` để truyền vào thông tin của những nhân vật CÓ XUẤT HIỆN trong trang đó**. Tuyệt đối không ném cả danh sách dàn cast 20 nhân vật vào.

**💣 Bom 2: Gãy tính năng Human-in-the-loop (UI Synchronization)**

* *Vấn đề:* Claude khen Weoweo có Two-stage approval (cho user duyệt/sửa trước khi sinh ảnh). Nhưng nếu anh thêm `sourceExcerpt` và `mustKeep` vào Prisma Database để làm mỏ neo, anh **BẮT BUỘC PHẢI UPDATE GIAO DIỆN FRONTEND**.
* *Cách fix:* Trên màn hình `review_storyboard` của user, anh phải expose 2 trường `sourceExcerpt` và `mustKeep` ra UI để họ có thể đối chiếu và edit. Nếu Backend giàu dữ liệu mà Frontend ẩn nó đi, user sẽ không thể can thiệp xóa lỗi nếu LLM bước 2 lỡ trích xuất nhầm (tiết kiệm được tiền gen ảnh hỏng).

**Tóm lại:** Lời khuyên của **Claude Opus 4.6** giữ được linh hồn của MVP (nhanh, rẻ, tận dụng code cũ đang chạy tốt) nhưng "bắt đúng bệnh" của vấn đề. Làm đúng Blueprint gồm 3 bước trên, tình trạng AI tự bịa cảnh hay trẻ con biến thành người lớn sẽ giảm 90%! Chúc anh refactor codebase thành công rực rỡ.