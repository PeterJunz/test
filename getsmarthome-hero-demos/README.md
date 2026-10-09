# GetSmartHome — 11 bản demo Hero Banner 3D (Warm Premium)

Đây là 10 bản **prototype hero banner 3D** để chọn cho getsmarthome.net, theo phong cách Warm Premium cho sản phẩm Home & Lifestyle. Mỗi demo là một trang chạy thật, viết bằng **Three.js (WebGL/GLSL) + GSAP**, có responsive cho desktop và mobile.

> ⚠️ **Trạng thái:** đây là các bản demo độc lập để chọn. Chưa demo nào được ghép vào website getsmarthome.net hay đưa lên store Shopify. Phần tích hợp Shopify bên dưới chỉ là hướng dẫn và mã nguồn chuẩn bị sẵn.

---

## 1. Chạy thử trên máy

Các demo dùng ES modules nên cần mở qua một web server (mở file trực tiếp bằng `file://` sẽ không chạy):

```bash
cd getsmarthome-hero-demos
npx http-server . -p 5173 -c-1      # hoặc: python3 -m http.server 5173
# mở http://localhost:5173/  → trang gallery chọn demo
```

Three.js và GSAP đã nằm sẵn trong thư mục `vendor/`, nên **không cần `npm install` để xem demo**. Font Fraunces và Inter được tải từ Google Fonts; nếu máy offline, trang tự dùng font serif/sans có sẵn.

## 2. Cấu trúc thư mục

```
getsmarthome-hero-demos/
├── index.html                 Gallery: thumbnail desktop + mobile của 10 demo
├── shared/
│   ├── hero.css               Giao diện chung: bảng màu warm, chữ, nút, thẻ foil, responsive
│   ├── core.js                Runtime dùng chung: renderer, pointer, vòng lặp, GSAP intro (blur reveal),
│   │                          tilt + spotlight thẻ, parallax, reduced-motion, fallback khi không có WebGL
│   ├── products.js            Sản phẩm dựng bằng code: bình gốm, đèn bàn, loa, nến, cốc, máy khuếch tán
│   └── demos.js               Danh sách 10 demo (tên + kỹ thuật)
├── demos/
│   ├── 01-golden-hour/        index.html + main.js (mỗi demo một thư mục)
│   ├── …
│   └── 10-wood-mosaic/
├── vendor/                    three@0.170.0 (MIT), gsap@3.12.5 (Standard "no charge" license)
├── shopify/
│   ├── sections/gsh-hero-3d.liquid   Section OS 2.0, có setting chọn 1 trong 11 kiểu
│   └── assets/                       gsh-hero.css + gsh-hero-01.js … gsh-hero-11.js (bản build)
├── tools/
│   ├── make-pages.mjs         Sinh demos/*/index.html từ một template chung
│   ├── check.mjs              Kiểm thử headless (Playwright): lỗi console, tràn ngang, reveal, ảnh chụp
│   └── build-shopify.mjs      Đóng gói từng demo thành 1 file IIFE cho Shopify (esbuild)
└── docs/screens, docs/thumbs  Ảnh chụp desktop (1440×900) + mobile (390×844)
```

## 3. Mười một demo

Mọi demo đều có chung các hiệu ứng: **tilt theo chuột** (cảnh 3D và thẻ sản phẩm), **spotlight + foil** (vệt sáng theo con trỏ cùng lớp foil ánh champagne trên thẻ, kèm nguồn sáng trong cảnh 3D đi theo chuột), **parallax** (theo chuột và theo cuộn trang) và **reveal blur** (chữ và canvas hiện dần từ mờ sang nét bằng GSAP).

| # | Demo | Kỹ thuật nền / chuyển động riêng |
|---|------|------------------------------|
| 01 | Golden Hour Studio | Sản phẩm PBR trên bục, đổ bóng mềm; bầu trời hoàng hôn viết bằng GLSL (mặt trời + film grain); spotlight chạy theo chuột trên sàn; GSAP điều khiển mặt trời mọc, đèn bật và camera dolly |
| 02 | Silk Flow | Shader GLSL toàn màn hình mô phỏng lụa satin (domain-warp noise, normal tính bằng sai phân hữu hạn, sheen Blinn); con trỏ đẩy nếp lụa và làm điểm sáng; bình gốm lơ lửng |
| 03 | Particle Morph | 32k hạt GPU lấy mẫu từ bề mặt 3 sản phẩm (loa → bình → đèn); GSAP biến hình; nhiễu xoáy khi chuyển hình; hạt né con trỏ; tên trên thẻ đổi kèm hiệu ứng blur |
| 04 | Glass & Light | Kính vật lý (transmission, IOR, attenuation) khúc xạ vách gỗ óc chó dạng nan và nền bokeh GLSL động; đèn điểm chạy theo chuột tạo vệt sáng trên kính |
| 05 | Liquid Brass | Khối đồng thau lỏng: vertex shader dịch chuyển bằng simplex noise, normal tính lại; iridescence tạo hiệu ứng foil; con trỏ làm lõm bề mặt; rê chuột lên thẻ thì khối "nóng chảy" mạnh hơn (GSAP elastic) |
| 06 | Paper Arches | 5 lớp vòm giấy cắt (Shape), đổ bóng lên nhau; shader hoà tan có viền cháy, xuất hiện lần lượt từ sau ra trước; parallax sâu theo từng lớp |
| 07 | Window Light | "Gobo" viết bằng GLSL: khung cửa sổ, rèm lá sách và bóng lá cây bay theo gió chiếu lên tường và sàn; chuột điều khiển hướng nắng và bóng đổ; tia nắng additive và bụi lơ lửng |
| 08 | Turntable | Bàn xoay 3 sản phẩm trên sàn phản chiếu thật (Reflector); GSAP xoay 120° mỗi 4,2 giây (hoặc bấm vào cảnh / phím ←→); thẻ đổi tên sản phẩm |
| 09 | Ripple Glaze | Render cảnh vào render target, mô phỏng sóng bằng phương trình sóng ping-pong trên GPU; rê chuột tạo gợn khúc xạ cảnh như men gốm ướt; trên mobile có giọt tự rơi |
| 10 | Wood Mosaic | Một InstancedMesh khoảng 960 ô gỗ (1 draw call); sóng chạy trên GPU, ô nhô lên dưới con trỏ, intro dạng thác lan toả; rê chuột lên thẻ phát ra một vòng sóng |
| 11 | Architectural Grid | Lưới phối cảnh vô tận viết bằng GLSL (khử răng cưa bằng `fwidth`, mờ dần vào đường chân trời), hai dải tường ánh sáng cong có vệt sáng phát quang, quầng sáng chân trời, hồ phản chiếu hình elip; camera nghiêng theo chuột, spotlight chạy trên lưới; GSAP vẽ lưới từ chân trời và nâng các dải sáng |

### Responsive, hiệu năng và khả năng tiếp cận
- **Mobile:** sản phẩm 3D đặt ở nửa trên màn hình, chữ ở nửa dưới, có gradient nền để chữ dễ đọc. Số hạt, độ chi tiết lưới, độ phân giải render target và DPR (tối đa 1,5) đều được giảm. Trên thiết bị cảm ứng, tilt và parallax tự "trôi" nhẹ vì không có chuột.
- **Tiết kiệm tài nguyên:** vòng lặp render tạm dừng khi hero ra khỏi màn hình hoặc khi chuyển tab.
- **`prefers-reduced-motion`:** chỉ render một khung tĩnh, bỏ animation, chữ hiện ngay.
- **Không có WebGL:** hiện nền gradient warm; chữ, nút và thẻ vẫn hoạt động bình thường.
- **GSAP chạy theo thời gian thực** (`lagSmoothing(0)`), nên trên máy yếu chữ vẫn hiện đúng lúc, không bị kéo dài.

## 4. Kết quả kiểm thử (đã chạy thật)

`tools/check.mjs` chạy Chromium headless với GPU giả lập bằng phần mềm (SwiftShader):

| Bộ kiểm tra | Kết quả |
|---|---|
| Bình thường: 11 demo × (desktop 1440×900 + mobile 390×844) | **22/22 PASS**: WebGL khởi tạo được, không lỗi JS/console/404, không tràn ngang, toàn bộ chữ reveal xong |
| `MODE=reduced` (prefers-reduced-motion) | **22/22 PASS** |
| `MODE=nowebgl` (tắt WebGL) | **22/22 PASS**: fallback hoạt động, chữ hiển thị đủ |
| Shopify section `gsh-hero-3d.liquid` (Shopify Theme Check) | 0 lỗi, 3 cảnh báo `RemoteAsset` cho Google Fonts tuỳ chọn (mặc định tắt) |
| Bundle Shopify 01 / 05 / 09 chạy trong trang mô phỏng section | WebGL chạy, không lỗi JS, không hiện thanh chuyển demo, CSS không ảnh hưởng ra ngoài section |

**Chưa đo / chưa kiểm chứng được:**
- **FPS thật:** con số FPS trong log là của GPU phần mềm (1–12 fps), không phản ánh máy thật. Hiệu năng trên iPhone/Android và laptop thật **chưa được đo**; nên thử trên thiết bị thật trước khi chọn.
- **Lighthouse / Core Web Vitals:** chưa đo.
- **Safari / Firefox:** chưa kiểm thử, chỉ chạy trên Chromium.
- **Sản phẩm:** đều là mô hình dựng bằng code (placeholder). Bản thật nên dùng file GLB của sản phẩm thật, xem mục 6.

Chạy lại kiểm thử:
```bash
npm install                       # three, gsap, esbuild, playwright-core
CHROMIUM=/đường/dẫn/chrome npm run check
npm run check:reduced && npm run check:nowebgl
```

## 5. Tích hợp vào Shopify (sau khi đã chọn demo)

Phần này **chưa được thực hiện trên store**; dưới đây là các bước đề xuất.

1. **Build assets:** chạy `npm install` rồi `npm run build:shopify`. Kết quả nằm trong `shopify/assets/`: `gsh-hero.css` (~9 KB, đã scope trong `.gsh-hero`, không reset CSS toàn trang) và `gsh-hero-XX.js`.
   - Mỗi file JS đã gói kèm demo, runtime, Three.js và GSAP: khoảng **750 KB chưa nén, ~203 KB gzip**. Shopify CDN tự nén khi phục vụ.
2. **Chỉ upload file cần dùng:** vào Admin → Online Store → Themes → `…` → **Edit code**, upload vào **Assets** file `gsh-hero.css` và đúng một file `gsh-hero-XX.js` của demo đã chọn.
3. **Thêm section:** tạo `sections/gsh-hero-3d.liquid`, dán nội dung từ `shopify/sections/gsh-hero-3d.liquid`.
4. **Bật trên trang chủ:** trong Theme Editor, chọn **Add section → 3D hero banner**.
   - Chọn **3D style** trùng với file đã upload, chọn màu sáng/tối (nên dùng nền tối cho 03, 05, 10).
   - Điền tiêu đề, nút và thẻ sản phẩm (ảnh, tên, link).
   - Chỉnh **Space for transparent header** cho khớp với chiều cao header của theme.
5. **Nên làm thử trên theme bản sao** (Duplicate theme) và xem trước trước khi Publish.

**Lưu ý khi tích hợp:**
- Mỗi trang chỉ hỗ trợ **một** hero 3D.
- Hai demo **03** (Particle Morph) và **08** (Turntable) đổi tên sản phẩm trên thẻ theo mảng `SHAPES` / `ITEMS` trong `main.js`. Sửa tên ở đó cho đúng sản phẩm thật rồi build lại.
- Có thể giảm dung lượng bundle bằng cách đổi `import * as THREE` sang import theo tên để tree-shaking. Việc này chưa làm.
- Font: mặc định section dùng font của theme. Bật "Load Fraunces + Inter" nếu muốn giống hệt demo.
- Giấy phép: Three.js theo MIT. GSAP theo GreenSock Standard "no charge" License, được dùng miễn phí trên website thương mại; xem `vendor/gsap/LICENSE.txt`.

## 6. Thay mô hình bằng sản phẩm thật (khuyến nghị)

Các demo 01, 02, 04–10 nhận một `THREE.Group`, nên có thể thay hàm `makeLamp()`, `makeVase()`… bằng mô hình GLB:

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';   // copy từ three/examples/jsm
const gltf = await new GLTFLoader().loadAsync('/path/product.glb');
group.add(gltf.scene);
```

Riêng demo 03 lấy mẫu hạt từ bất kỳ mesh nào, nên có thể dùng chính file GLB của sản phẩm. Nên tối ưu GLB (Draco/meshopt, texture KTX2) xuống dưới khoảng 1–2 MB.
