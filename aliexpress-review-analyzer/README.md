# AliExpress Review Analyzer Pro

Công cụ thu thập (từ nguồn hợp lệ), lọc, phân loại và phân tích đánh giá sản phẩm AliExpress — dành cho người làm Shopify Dropshipping cần kiểm tra chất lượng sản phẩm trước khi bán tại thị trường Mỹ.

React 19 · TypeScript · Vite · Tailwind CSS v4 · Lucide · Recharts · proxy Node.js nhỏ gọn cho API key và AI.

> **Không có dữ liệu giả trên dashboard.** Mọi con số được tính từ dữ liệu bạn nạp vào. Bộ dữ liệu demo (nếu bạn chủ động bấm "Load demo") được gắn nhãn **DEMO** ở mọi nơi: banner, header, tên dataset, cột `data_origin` khi xuất file, báo cáo PDF. Ảnh trong demo là ảnh giữ chỗ ghi rõ *"not a real customer photo"*.

---

## 1. Lấy dữ liệu AliExpress hợp lệ — kết quả nghiên cứu

| Nguồn | Trạng thái | Ghi chú |
|---|---|---|
| **AliExpress Open Platform** (openservice.aliexpress.com — Affiliate / Dropshipping API) | ❌ Không dùng được cho review | API cấp cho tài khoản developer đã được duyệt; cung cấp thông tin sản phẩm, giá, vận chuyển, đơn hàng. Chúng tôi **không xác minh được endpoint công khai nào trả về đánh giá của người mua**. Adapter `AliExpressOpenPlatformProvider` có trong mã nhưng cố ý không triển khai phương thức fetch, và UI hiển thị "Not available". Nếu app của bạn được cấp quyền API feedback, hãy triển khai `fetchReviews` theo tài liệu chính thức (phía server, vì cần app secret + ký request). |
| **Nhà cung cấp dữ liệu bên thứ ba** (ví dụ các API review AliExpress trên thị trường như SocialCrawl, anysite, các actor trên Apify, API trên RapidAPI…) | ✅ Hỗ trợ qua proxy | App có adapter chung `ProxyApiProvider`: bạn cấu hình URL template + key trên server. Bạn tự chịu trách nhiệm kiểm tra điều khoản, giấy phép và mức độ phủ dữ liệu của nhà cung cấp. Chúng tôi không xác nhận nhà cung cấp nào cả. |
| **Nhập file CSV / JSON** | ✅ Sẵn sàng | Export từ review app của store bạn, file tải từ nhà cung cấp, hoặc dữ liệu bạn có quyền sử dụng. Xử lý hoàn toàn trong trình duyệt. |
| **Scraping trang AliExpress** | 🚫 Không triển khai | App không scrape, không vượt CAPTCHA/anti-bot, không đăng nhập thay người dùng, không né giới hạn truy cập. |

**Lưu ý về độ đầy đủ:** nhà cung cấp bên thứ ba thường chỉ trả về một phần đánh giá (giới hạn số trang, sắp xếp mặc định…). Mỗi dataset có trường `completeness` (`complete` / `partial` / `unknown`) và banner cảnh báo tương ứng; app không bao giờ tuyên bố đã lấy "toàn bộ" đánh giá khi nguồn không xác nhận điều đó.

### Ngôn ngữ giao diện (Tiếng Việt / English)

- Chuyển ngôn ngữ bằng nút **VI / EN** ở góc phải header, hoặc trong **Cài đặt → Ngôn ngữ giao diện**. Lựa chọn được lưu trong trình duyệt; lần đầu mở, app tự chọn theo ngôn ngữ của trình duyệt.
- Toàn bộ giao diện được dịch: menu, bộ lọc, bảng, biểu đồ, thông báo, báo cáo import, trạng thái kết nối, tóm tắt rule-based, tên quốc gia/ngôn ngữ và định dạng ngày theo locale (`vi-VN` / `en-US`).
- Giữ nguyên tiếng Anh có chủ đích: nội dung đánh giá của khách hàng, tên cột và metadata trong file xuất (CSV/JSON/XLSX dùng tên cột chuẩn để nhập lại được), báo cáo PDF (font PDF tích hợp không hiển thị được dấu tiếng Việt), và thông báo lỗi kỹ thuật từ server/nhà cung cấp.
- Ngôn ngữ của bản tóm tắt AI được chọn riêng (Cài đặt → AI).
- Từ điển: `src/i18n/en.ts` (nguồn) và `src/i18n/vi.ts`. TypeScript báo lỗi nếu bản tiếng Việt thiếu khóa; unit test kiểm tra hai bản dùng cùng placeholder. Thêm ngôn ngữ mới: tạo file từ điển cùng kiểu và đăng ký trong `src/i18n/translate.ts`.

---

## 2. Cài đặt & chạy

Yêu cầu: Node.js ≥ 20.19 (đã thử với Node 22).

```bash
cd aliexpress-review-analyzer
npm install

# Giao diện (http://localhost:5173)
npm run dev

# (Tuỳ chọn) Proxy cho nhà cung cấp dữ liệu + AI (http://127.0.0.1:8787)
cp .env.example .env      # điền APP_ACCESS_TOKEN, REVIEW_API_*, ANTHROPIC_API_KEY
npm run server
```

Chỉ dùng import file? Không cần chạy proxy.

Build production:

```bash
npm run build      # typecheck + build vào dist/
npm run preview    # phục vụ dist/ tại http://localhost:4173
```

### Kiểm tra chất lượng

```bash
npm run lint       # ESLint (cấm innerHTML, quy tắc React hooks)
npm run typecheck  # tsc --noEmit cho app + server
npm test           # Vitest: 116 test cho normalizer, filter, sentiment, import/export, proxy, i18n
npm run build
```

---

## 3. Sử dụng nhanh

1. **Nạp dữ liệu** — một trong ba cách:
   - *Data Sources & Import* → kéo thả file CSV/JSON → kiểm tra ánh xạ cột → **Validate** → xem báo cáo (số dòng hợp lệ / bị bỏ qua / lý do) → **Save**.
   - Cấu hình proxy (mục 4) → dán URL sản phẩm vào ô trên header → **Analyze Reviews**.
   - *Load labelled demo data* để thử giao diện.
2. **Overview** — tổng số review, điểm trung bình (kèm điểm của người mua Mỹ), % tích cực / tiêu cực, số review có ảnh / video, biểu đồ phân bố sao, số review và điểm trung bình theo tháng. Bật *Apply current filters* để dashboard tính theo bộ lọc hiện tại.
3. **All / Positive / Negative / Photo / Video Reviews** — bảng có thể sắp xếp, phân trang (25/50/100), tìm kiếm, chọn nhiều dòng, **chọn tất cả kết quả đã lọc** (không chỉ trang hiện tại), xem chi tiết, xem ảnh lớn, mở review gốc (chỉ khi có URL hợp lệ), chế độ thẻ cho review có ảnh.
4. **Review Insights** — tóm tắt rule-based (luôn ghi rõ dựa trên bao nhiêu review), chủ đề khen/chê kèm **trích dẫn nguyên văn** của khách hàng, các khía cạnh sản phẩm (size, chất liệu, chất lượng, giao hàng, độ bền, đóng gói…) và phân tích AI tuỳ chọn.
5. **Export Data** — CSV, JSON, XLSX, báo cáo PDF theo bộ lọc hiện tại, theo lựa chọn, hoặc preset ("Tất cả 5 sao", "1 sao có ảnh", "Review tiêu cực", "Tất cả có ảnh", "Mỹ 90 ngày").

### Bộ lọc (kết hợp được tất cả)

| Bộ lọc | Chi tiết |
|---|---|
| Số sao | Chọn nhiều mức 1–5, có số lượng từng mức |
| Cảm xúc | Positive / Neutral / Negative / Uncertain |
| Nội dung | Có ảnh · có video · có văn bản (mỗi mục: Any / Yes / No) |
| Thời gian | 30 / 90 / 180 / 365 ngày hoặc khoảng tuỳ chọn (review không có ngày bị loại khi lọc theo ngày, và UI báo số lượng) |
| Quốc gia | Theo mã ISO; tên quốc gia phổ biến được chuẩn hoá (United States → US) |
| Ngôn ngữ | Lấy từ nguồn nếu có, nếu không thì nhận diện heuristic (`und` khi không chắc) |
| Khía cạnh | Size, Material, Quality, Shipping, Durability, Packaging, Functionality, Description match, Value, Ease of use |
| Chủ đề | 7 chủ đề tích cực + 10 chủ đề tiêu cực (đúng như yêu cầu B và C) |
| Tìm kiếm | Nhiều từ = AND, `"cụm từ"`, `-loại_trừ`, bỏ dấu (qualite = qualité) |

Ví dụ trong yêu cầu — *1 sao, có ảnh, người mua Mỹ, 90 ngày gần nhất*: tick 1★, Photos = Yes, chip US, chip 90 days.

---

## 4. Kết nối nhà cung cấp dữ liệu (proxy)

Trình duyệt **không** gọi trực tiếp nhà cung cấp. Proxy (`server/`) giữ API key, xác thực UI bằng token, giới hạn tốc độ, và **cố định host upstream** theo template — trình duyệt chỉ gửi `productId` (6–20 chữ số) và `page` (1–500), nên proxy không thể bị dùng như open proxy/SSRF.

`.env`:

```ini
APP_ACCESS_TOKEN=<chuỗi ngẫu nhiên ≥16 ký tự>
REVIEW_PROVIDER_NAME=My provider
REVIEW_API_URL_TEMPLATE=https://api.your-provider.example/aliexpress/reviews?product_id={productId}&page={page}
REVIEW_API_KEY=<key của bạn>
REVIEW_API_KEY_HEADER=x-api-key          # hoặc X-RapidAPI-Key, Authorization…
REVIEW_API_KEY_PREFIX=                   # "Bearer " nếu dùng Authorization
REVIEW_API_EXTRA_HEADERS={"X-RapidAPI-Host":"…"}   # nếu nhà cung cấp yêu cầu
```

Trong app: **Settings → Data provider** → nhập Proxy URL và access token → *Test connection*. Trạng thái trên header chỉ hiện **Provider connected** khi proxy thực sự trả lời và đã cấu hình provider + key. Lỗi của nhà cung cấp (401/403, 429, timeout, không phải JSON, redirect) được báo nguyên nhân rõ ràng.

**Ánh xạ phản hồi** (Settings → Response mapping): để trống là tự nhận diện mảng review và tên trường (ví dụ `buyerEval`, `buyerFeedback`, `evalDate`, `buyerCountry`, `images`). Có thể chỉ định đường dẫn (`data.reviews`), đường dẫn tổng số review (`data.total`), thang điểm (1–5 hoặc 20–100) và tên trường cụ thể. *Max pages per analysis* giới hạn số lần gọi để tiết kiệm quota; nếu dừng sớm, dataset được đánh dấu `partial`.

---

## 5. Import CSV / JSON

- Giới hạn: **20 MB**, **50.000 dòng**, phần mở rộng `.csv` `.tsv` `.txt` `.json`.
- JSON: mảng ở gốc hoặc lồng bên trong (`reviews`, `data`, `items`, `results`… — tự tìm); object lồng được làm phẳng thành `buyer.country`.
- Trường chuẩn: `rating` (**bắt buộc**), `review_text`, `review_date`, `reviewer_country`, `product_variant`, `review_images`, `review_video`, `source_url`, cùng `language`, `helpful_count`, `product_id`, `review_id`. Cột được tự ánh xạ theo tên/đồng nghĩa và có thể chỉnh tay.
- Có nút tải **CSV template**. File mẫu để thử: `samples/SAMPLE-reviews-for-testing.csv`, `samples/SAMPLE-provider-response.json` (ghi rõ SAMPLE DATA, chứa cả dòng lỗi có chủ đích).

| Trường hợp | Xử lý |
|---|---|
| File sai định dạng / JSON hỏng / không có header | Báo lỗi, không nhập gì |
| Thiếu cột bắt buộc | Không cho Validate cho tới khi ánh xạ `rating` |
| Thiếu số sao | Bỏ dòng (*Rating is missing*) |
| Số sao ngoài 1–5 hoặc lẻ (4.5) | Bỏ dòng (*not a whole number from 1 to 5*). Chấp nhận `5`, `5.0`, `4 stars`, `★★★★☆`, thang 20/40/60/80/100 |
| Trùng lặp | Bỏ dòng trùng theo `review_id`, hoặc theo nội dung (sao + text + ngày + quốc gia + biến thể + ảnh). Dòng chỉ có sao, không text/ID/ảnh **không** bị coi là trùng (có thể là người mua khác nhau) |
| Ngày không hợp lệ | Giữ dòng, để trống ngày, cảnh báo. Hỗ trợ ISO, `05 Mar 2026`, `Mar 5, 2026`, `dd/mm/yyyy` / `mm/dd/yyyy` (chọn thứ tự khi mơ hồ), Unix timestamp |
| URL ảnh/video/nguồn không hợp lệ | Loại bỏ URL đó (chỉ chấp nhận `http(s)://` và `//`), cảnh báo |
| Văn bản > 5.000 ký tự | Cắt và cảnh báo |

Báo cáo sau Validate: tổng dòng, số hợp lệ, số bị bỏ qua, nguyên nhân theo từng loại và chi tiết từng dòng (25 dòng đầu).

---

## 6. Phân tích cảm xúc & AI

**Rule-based (mặc định, chạy offline):**
- Lexicon thương mại điện tử (tiếng Anh đầy đủ nhất; es/pt/fr/de/ru/vi cơ bản), xử lý phủ định, từ nhấn mạnh, mệnh đề "but".
- Số sao là *tiên nghiệm*, văn bản là *bằng chứng*. 4–5★ → tham khảo tích cực, 1–2★ → tham khảo tiêu cực, **3★ mặc định trung lập** trừ khi văn bản rất rõ ràng.
- **Uncertain** khi văn bản mâu thuẫn mạnh với số sao (ví dụ 5★ nhưng "broken, waste of money").
- Review không có chữ hoặc ngôn ngữ chưa hỗ trợ → chỉ dựa vào sao, độ tin cậy thấp và ghi rõ lý do (`method: rating-only`).
- Mỗi kết quả có `confidence` (heuristic, không phải xác suất) và `reason` hiển thị trong chi tiết review.

**AI (Claude, tuỳ chọn):**
- Tắt mặc định. Cần: bật trong Settings **và** tick đồng ý gửi dữ liệu **và** bấm *Run AI analysis*. Key đặt ở server (`ANTHROPIC_API_KEY`) hoặc nhập trong Settings (gửi tới proxy của bạn theo từng request).
- Chỉ gửi: ID nội bộ, số sao, văn bản, biến thể — tối đa 300 review / 100.000 ký tự mỗi lần. Không gửi quốc gia, ảnh, URL.
- Mô hình mặc định `claude-opus-5-5` (đổi bằng `ANTHROPIC_MODEL`), structured output JSON schema, server-side fallback khi mô hình từ chối. Kết quả gồm: tóm tắt (EN hoặc VI), ưu điểm phổ biến, phàn nàn phổ biến, lỗi lặp lại, vấn đề chất liệu, đóng gói/vận chuyển, kỳ vọng không đạt, điều khách đánh giá cao, và sentiment từng review kèm độ tin cậy.
- **Mỗi luận điểm của AI phải trích dẫn ID review**; app kiểm tra lại với dataset, loại bỏ ID không tồn tại và ẩn luận điểm không còn bằng chứng. UI phân biệt rõ nhãn *AI inference* với *Customer quote* (trích nguyên văn, bấm để mở review).
- Khi đã chạy AI, bộ lọc cảm xúc dùng kết quả AI cho các review đã phân tích (badge "AI"); có nút *Clear AI results*.

---

## 7. Bảo mật & quyền riêng tư

- Không hardcode API key; key nằm trong `.env` của server hoặc sessionStorage (localStorage chỉ khi bật *Remember keys*). Trang Settings có quản lý key và *Forget all keys*.
- Không yêu cầu / lưu thông tin đăng nhập AliExpress. Không thu thập tên, avatar, ID tài khoản người đánh giá — các trường này không được import nên không thể bị export.
- Dữ liệu lưu cục bộ (IndexedDB). *Delete all data, history and settings* xoá toàn bộ dataset, kết quả AI, key và cài đặt; xoá từng dataset trong Data Sources.
- Nội dung review luôn hiển thị dạng text (React escape), không dùng `innerHTML` (ESLint chặn); HTML trong nguồn bị loại bỏ khi chuẩn hoá. URL được kiểm tra trước khi đưa vào `href`/`src`; link ngoài dùng `rel="noopener noreferrer nofollow"`, ảnh dùng `referrerPolicy="no-referrer"`.
- Bản build có Content-Security-Policy (`script-src 'self'`, `object-src 'none'`…).
- Export CSV/XLSX chống formula injection (ô bắt đầu bằng `= + - @` được thêm `'`).
- Proxy: token Bearer so sánh constant-time, rate limit (mặc định 60 req/phút, AI 20 req/giờ), CORS whitelist, giới hạn body 1 MB và response upstream 10 MB, timeout, không follow redirect, kiểm tra đầu vào, chỉ bind `127.0.0.1` mặc định. Không có token → server sinh token tạm và in ra console.
- Chặn prototype pollution khi làm phẳng JSON (`__proto__`, `constructor`, `prototype`).

---

## 8. Kiến trúc

```
src/
  components/            Header, Sidebar, ui primitives, banners, toasts
  pages/                 Overview, Insights, Export, DataSources, Settings
  features/
    dashboard/           stats.ts (số liệu), Charts.tsx
    reviews/             ReviewsView (bảng/thẻ), ReviewDetail, media (thumb, lightbox, video)
    filters/             filterReviews.ts (lọc/sắp xếp/facet), FilterPanel, scope, describeFilters
    insights/            insights.ts (chủ đề, khía cạnh, tóm tắt rule-based), AiPanel
    import/              ImportWizard
    export/              runExport
  services/
    data-providers/      types.ts (ReviewProvider), proxyApiProvider, aliexpressOpenPlatform, demoProvider
    review-normalizer/   fields (ánh xạ), parse (CSV/JSON), normalize (kiểm tra, làm sạch, khử trùng lặp)
    sentiment-analysis/  lexicon, taxonomy, analyzer, aiClient
    export/              rows (CSV/JSON), xlsx, pdf, download
    storage/             datasetStore (IndexedDB), settings
  hooks/                 AppProvider/appContext (state), useAnalyze, useLoadDemo
  types/                 review.ts, filters.ts
  utils/                 date, country, language, url, hash, objectPath
  i18n/                  en.ts, vi.ts (từ điển), I18nProvider, translate (nội suy, số ít/nhiều)
  styles/                index.css (design tokens light/dark)
server/                  index.ts, app.ts (routes), config.ts, ai.ts (Claude), rateLimit.ts
samples/                 file mẫu để thử import (SAMPLE DATA)
```

### Interface data provider

```ts
interface ReviewProvider {
  id: string; name: string; description: string;
  capabilities: { productInfo; reviews; reviewImages; reviewVideos; pagination; completeReviewSet };
  validateConnection(): Promise<ConnectionStatus>;
  fetchProductInfo?(productId): Promise<ProductInfo>;
  fetchReviews?(productId, page, options): Promise<FetchReviewsResult>;
  fetchReviewImages?(productId, reviewId): Promise<string[]>;
  getPaginationInfo?(): PaginationInfo | undefined;
}
```

Phương thức tuỳ chọn chỉ được triển khai khi nguồn thực sự hỗ trợ (ví dụ adapter AliExpress Open Platform không có `fetchReviews`). Mọi nguồn đều đi qua cùng `normalizeRows` / `buildReview`, nên UI, bộ lọc và export không phụ thuộc nguồn.

**Thêm nguồn mới:** tạo class trong `services/data-providers/` implement `ReviewProvider`, chuyển bản ghi thô qua `normalizeRows(rows, mapping, …)`, rồi dùng nó trong `useAnalyze`. Nếu cần secret, thêm route trên proxy thay vì gọi từ trình duyệt.

---

## 9. Giới hạn đã biết

- Nhận diện chủ đề/khía cạnh dựa trên từ khoá: tốt nhất với tiếng Anh, có thể bỏ sót cách diễn đạt khác hoặc nhận nhầm. Dùng AI để có kết quả tốt hơn cho review đa ngôn ngữ.
- Nhận diện ngôn ngữ là heuristic; văn bản ngắn trả về `und`.
- Font PDF tích hợp chỉ hỗ trợ ký tự Latin: tiếng Việt bị bỏ dấu, chữ Cyrillic/CJK bị lược khỏi trích dẫn trong PDF (CSV/XLSX/JSON giữ nguyên UTF-8).
- Video chỉ có khi nguồn cung cấp URL video; trình phát nhúng chỉ hỗ trợ file `.mp4/.webm/.mov/.m4v/.ogg`, còn lại mở link.
- Ảnh review tải trực tiếp từ CDN của nguồn; nếu CDN chặn hoặc URL hết hạn, app hiển thị "unavailable" thay vì ảnh thay thế.
- Proxy dùng rate limit trong bộ nhớ, phù hợp chạy cục bộ một tiến trình; khi triển khai công khai cần thêm HTTPS, reverse proxy và lưu trữ rate limit dùng chung.
