// Client tối giản cho Facebook Graph API.

const Graph = {
  token: "",
  version: "v23.0",

  async init() {
    this.token = await store.get("token", "");
    this.version = await store.get("apiVersion", "v23.0");
  },

  url(path, params = {}) {
    const u = new URL(`https://graph.facebook.com/${this.version}/${path.replace(/^\//, "")}`);
    for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
    return u;
  },

  async request(path, params = {}, method = "GET") {
    if (!this.token) throw new Error("Chưa có Access Token. Vào mục Cài đặt token để thêm.");
    let res;
    if (method === "GET") {
      res = await fetch(this.url(path, { ...params, access_token: this.token }));
    } else {
      const body = new URLSearchParams({ ...params, access_token: this.token });
      res = await fetch(this.url(path), { method, body });
    }
    return this._parse(res);
  },

  async _parse(res) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      const e = data.error || {};
      const err = new Error(e.error_user_msg || e.message || `HTTP ${res.status}`);
      err.code = e.code;
      throw err;
    }
    return data;
  },

  // Lấy toàn bộ dữ liệu theo trang (paging.next).
  async all(path, params = {}, onProgress) {
    const out = [];
    let data = await this.request(path, { limit: 100, ...params });
    for (;;) {
      out.push(...(data.data || []));
      onProgress?.(out.length);
      const next = data.paging?.next;
      if (!next) break;
      const res = await fetch(next);
      data = await this._parse(res);
    }
    return out;
  },

  // Gửi nhiều request trong 1 lần (tối đa 50/batch).
  async batch(requests) {
    const results = [];
    for (let i = 0; i < requests.length; i += 50) {
      const chunk = requests.slice(i, i + 50);
      const data = await this.request("", { batch: JSON.stringify(chunk), include_headers: "false" }, "POST");
      for (const r of data) {
        if (!r) { results.push({ error: { message: "Timeout" } }); continue; }
        let body = {};
        try { body = JSON.parse(r.body); } catch {}
        results.push(r.code === 200 ? body : { error: body.error || { message: `HTTP ${r.code}` } });
      }
    }
    return results;
  },
};

// Trạng thái tài khoản quảng cáo theo tài liệu Marketing API.
const ACCOUNT_STATUS = {
  1: ["Hoạt động", "ok"],
  2: ["Vô hiệu hoá", "bad"],
  3: ["Nợ chưa thanh toán", "warn"],
  7: ["Đang xét duyệt rủi ro", "warn"],
  8: ["Chờ thanh toán", "warn"],
  9: ["Thời gian gia hạn", "warn"],
  100: ["Chờ đóng", "neutral"],
  101: ["Đã đóng", "neutral"],
  201: ["Hoạt động (bất kỳ)", "ok"],
  202: ["Đã đóng (bất kỳ)", "neutral"],
};

const DISABLE_REASON = {
  0: "",
  1: "Vi phạm chính sách quảng cáo",
  2: "Đang xem xét IP",
  3: "Rủi ro thanh toán",
  4: "Tài khoản xám bị tắt",
  5: "Đang xem xét AFC",
  6: "Doanh nghiệp vi phạm (RAR)",
  7: "Đóng vĩnh viễn",
  8: "Không sử dụng (reseller)",
  9: "Không sử dụng",
  10: "Tài khoản umbrella",
  11: "BM vi phạm chính sách",
  12: "Tài khoản khai báo sai",
  13: "Pháp nhân huỷ chia sẻ",
  14: "Xem xét hội thoại",
  15: "Tài khoản bị xâm phạm",
};

// Các loại tiền không có phần thập phân trong Marketing API (giá trị trả về đã là đơn vị chính).
const ZERO_DECIMAL = new Set(["VND", "JPY", "KRW", "CLP", "COP", "CRC", "HUF", "ISK", "IDR", "PYG", "TWD"]);

// amount_spent, balance, spend_cap, budget... trả về theo đơn vị nhỏ nhất (cents).
function money(value, currency) {
  if (value == null || value === "") return "";
  const n = Number(value) / (ZERO_DECIMAL.has(currency) ? 1 : 100);
  return `${fmtNum(n, 2)} ${currency || ""}`.trim();
}
