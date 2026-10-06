// Logic chính của dashboard.

const state = {
  accounts: [],   // tài khoản quảng cáo
  spend: {},      // { act_id: spend } theo khoảng thời gian đã chọn
  spendPreset: "",
  campaigns: [],
  selectedCamps: new Set(),
  bms: [],
  pages: [],
};

/* ------------------------------ Điều hướng ------------------------------ */

function showTab(name) {
  $$("#nav button").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  $$(".tab").forEach(s => s.classList.toggle("active", s.id === `tab-${name}`));
  store.set("lastTab", name);
}
$$("#nav button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));

function updateStats() {
  const acc = state.accounts;
  $("#statAcc").textContent = acc.length || "–";
  $("#statActive").textContent = acc.length ? acc.filter(a => a.account_status === 1).length : "–";
  $("#statDisabled").textContent = acc.length ? acc.filter(a => a.account_status === 2).length : "–";
  $("#statBm").textContent = state.bms.length || "–";
  $("#statPages").textContent = state.pages.length || "–";
}

/* ------------------------------ Token / Cài đặt ------------------------------ */

async function renderUser() {
  const box = $("#userBox");
  const me = await store.get("me");
  if (!Graph.token || !me) { box.replaceChildren("Chưa đăng nhập"); return; }
  box.replaceChildren(
    me.picture ? h("img", { src: me.picture, alt: "" }) : "",
    h("div", {}, h("div", { style: "color:var(--text);font-weight:600" }, me.name), h("div", {}, me.id)),
  );
}

async function checkToken() {
  const me = await Graph.request("me", { fields: "id,name,picture.width(64)" });
  const perms = await Graph.request("me/permissions").catch(() => ({ data: [] }));
  await store.set("me", { id: me.id, name: me.name, picture: me.picture?.data?.url });
  const granted = perms.data.filter(p => p.status === "granted").map(p => p.permission);
  $("#tokenInfo").replaceChildren(
    h("p", {}, "✅ Token hợp lệ: ", h("b", {}, me.name), ` (${me.id})`),
    h("p", {}, "Quyền đã cấp: ", granted.length ? granted.map(p => [badge(p, "ok"), " "]) : badge("không rõ")),
  );
  renderUser();
}

busy($("#btnSaveToken"), async () => {
  const token = $("#tokenInput").value.trim();
  if (!token) throw new Error("Vui lòng dán Access Token");
  Graph.token = token;
  Graph.version = $("#apiVersion").value.trim() || "v23.0";
  await checkToken();
  await store.set("token", token);
  await store.set("apiVersion", Graph.version);
  toast("Đã lưu token");
});

busy($("#btnClearToken"), async () => {
  Graph.token = "";
  $("#tokenInput").value = "";
  $("#tokenInfo").replaceChildren();
  await chrome.storage.local.remove(["token", "me", "accounts", "bms", "pages"]);
  Object.assign(state, { accounts: [], spend: {}, bms: [], pages: [], campaigns: [] });
  renderAccounts(); renderBms(); renderPages(); fillCampAccounts(); updateStats(); renderUser();
  toast("Đã xoá token và dữ liệu đã lưu");
});

/* ------------------------------ Tài khoản quảng cáo ------------------------------ */

const ACC_FIELDS = "name,account_id,account_status,disable_reason,currency,amount_spent,balance,spend_cap,timezone_name,created_time,business{id,name}";

for (const [code, [label]] of Object.entries(ACCOUNT_STATUS)) {
  if (code < 200) $("#accStatus").append(h("option", { value: code }, label));
}

async function loadAccounts() {
  const btn = $("#btnLoadAcc");
  state.accounts = await Graph.all("me/adaccounts", { fields: ACC_FIELDS },
    n => { btn.textContent = `Đang tải… ${n}`; });
  btn.textContent = "🔄 Tải TK";
  state.spend = {};
  await store.set("accounts", state.accounts);
  renderAccounts(); fillCampAccounts(); updateStats();
  toast(`Đã tải ${state.accounts.length} tài khoản`);
}

function filteredAccounts() {
  const q = $("#accSearch").value.trim().toLowerCase();
  const st = $("#accStatus").value;
  return state.accounts.filter(a =>
    (!st || String(a.account_status) === st) &&
    (!q || a.name?.toLowerCase().includes(q) || a.account_id.includes(q) || a.business?.name?.toLowerCase().includes(q)));
}

function accStatusBadge(a) {
  const [label, kind] = ACCOUNT_STATUS[a.account_status] || [`#${a.account_status}`, "neutral"];
  return badge(label, kind);
}

function renderAccounts() {
  const hasSpend = Object.keys(state.spend).length > 0;
  const cols = [
    { title: "#", value: (a) => String(filteredIdx.get(a) + 1) },
    { title: "Tên tài khoản", value: a => a.name },
    { title: "ID", value: a => a.account_id },
    { title: "Trạng thái", value: accStatusBadge },
    { title: "Lý do khoá", value: a => DISABLE_REASON[a.disable_reason] ?? a.disable_reason },
    { title: "Tiền tệ", value: a => a.currency },
    { title: "Đã chi tiêu", num: true, value: a => money(a.amount_spent, a.currency) },
    { title: "Số dư nợ", num: true, value: a => money(a.balance, a.currency) },
    { title: "Giới hạn chi", num: true, value: a => Number(a.spend_cap) ? money(a.spend_cap, a.currency) : "Không" },
  ];
  if (hasSpend) cols.push({
    title: `Chi tiêu (${$("#accPreset").selectedOptions[0].text})`, num: true,
    value: a => {
      const s = state.spend[a.id];
      return s == null ? "" : s.error ? badge("Lỗi", "bad") : `${fmtNum(s, 2)} ${a.currency}`;
    },
  });
  cols.push(
    { title: "BM", value: a => a.business?.name || "Cá nhân" },
    { title: "Múi giờ", value: a => a.timezone_name },
    { title: "Ngày tạo", value: a => fmtDate(a.created_time) },
    { title: "", value: a => h("a", { href: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${a.account_id}`, target: "_blank", rel: "noopener" }, "Mở") },
  );
  const rows = filteredAccounts();
  const filteredIdx = new Map(rows.map((r, i) => [r, i]));
  renderTable($("#accTable"), cols, rows, {
    empty: Graph.token ? "Bấm “Tải TK” để lấy danh sách" : "Chưa có token — vào Cài đặt token",
    onRowClick: (a) => { $("#campAccount").value = a.id; showTab("campaigns"); loadCampaigns().catch(e => toast(e.message, true)); },
  });
}

async function loadSpend() {
  if (!state.accounts.length) throw new Error("Hãy tải danh sách tài khoản trước");
  const preset = $("#accPreset").value;
  const accs = filteredAccounts();
  const res = await Graph.batch(accs.map(a => ({
    method: "GET",
    relative_url: `${a.id}/insights?fields=spend&date_preset=${preset}`,
  })));
  state.spend = {};
  accs.forEach((a, i) => {
    const r = res[i];
    state.spend[a.id] = r.error ? { error: r.error.message } : Number(r.data?.[0]?.spend || 0);
  });
  renderAccounts();
  toast("Đã tải chi tiêu");
}

busy($("#btnLoadAcc"), loadAccounts);
busy($("#btnLoadSpend"), loadSpend);
$("#accSearch").addEventListener("input", renderAccounts);
$("#accStatus").addEventListener("change", renderAccounts);
$("#btnCopyAccIds").addEventListener("click", () => copyText(filteredAccounts().map(a => a.account_id).join("\n")));
$("#btnExportAcc").addEventListener("click", () => {
  const rows = filteredAccounts();
  downloadCsv(`tai-khoan-qc-${Date.now()}.csv`,
    ["Tên", "ID", "Trạng thái", "Lý do khoá", "Tiền tệ", "Đã chi tiêu", "Số dư nợ", "Giới hạn chi", "Chi tiêu kỳ", "BM", "Múi giờ", "Ngày tạo"],
    rows.map(a => [a.name, a.account_id, ACCOUNT_STATUS[a.account_status]?.[0] ?? a.account_status,
      DISABLE_REASON[a.disable_reason] ?? a.disable_reason, a.currency,
      money(a.amount_spent, a.currency), money(a.balance, a.currency), money(a.spend_cap, a.currency),
      typeof state.spend[a.id] === "number" ? state.spend[a.id] : "", a.business?.name || "", a.timezone_name, a.created_time]));
});

/* ------------------------------ Chiến dịch ------------------------------ */

function fillCampAccounts() {
  const sel = $("#campAccount");
  const cur = sel.value;
  sel.replaceChildren(h("option", { value: "" }, "— Chọn tài khoản QC —"),
    ...state.accounts.map(a => h("option", { value: a.id }, `${a.name} (${a.account_id})`)));
  sel.value = cur;
}

async function loadCampaigns() {
  const act = $("#campAccount").value;
  if (!act) throw new Error("Chọn tài khoản quảng cáo");
  const preset = $("#campPreset").value;
  state.campaigns = await Graph.all(`${act}/campaigns`, {
    fields: `name,status,effective_status,objective,daily_budget,lifetime_budget,created_time,insights.date_preset(${preset}){spend,impressions,clicks,ctr,cpc}`,
  });
  state.selectedCamps.clear();
  renderCampaigns();
}

function campCurrency() {
  return state.accounts.find(a => a.id === $("#campAccount").value)?.currency || "";
}

const EFFECTIVE = {
  ACTIVE: ["Đang chạy", "ok"], PAUSED: ["Tạm dừng", "neutral"], DELETED: ["Đã xoá", "bad"],
  ARCHIVED: ["Lưu trữ", "neutral"], IN_PROCESS: ["Đang xử lý", "warn"], WITH_ISSUES: ["Có vấn đề", "bad"],
  CAMPAIGN_PAUSED: ["CD tạm dừng", "neutral"], ADSET_PAUSED: ["Nhóm tạm dừng", "neutral"],
  PENDING_REVIEW: ["Chờ duyệt", "warn"], DISAPPROVED: ["Bị từ chối", "bad"],
};

function renderCampaigns() {
  const cur = campCurrency();
  const all = h("input", { type: "checkbox", onchange: (e) => {
    state.campaigns.forEach(c => e.target.checked ? state.selectedCamps.add(c.id) : state.selectedCamps.delete(c.id));
    renderCampaigns();
  } });
  all.checked = state.campaigns.length > 0 && state.selectedCamps.size === state.campaigns.length;
  const cols = [
    { title: all, value: c => h("input", { type: "checkbox", checked: state.selectedCamps.has(c.id), onchange: (e) => {
      e.target.checked ? state.selectedCamps.add(c.id) : state.selectedCamps.delete(c.id);
    } }) },
    { title: "Tên chiến dịch", value: c => c.name },
    { title: "ID", value: c => c.id },
    { title: "Trạng thái", value: c => { const [l, k] = EFFECTIVE[c.effective_status] || [c.effective_status, "neutral"]; return badge(l, k); } },
    { title: "Bật/Tắt", value: c => (c.status === "ACTIVE" || c.status === "PAUSED")
      ? h("button", { class: "small", onclick: (e) => toggleCampaign(c, e.target) }, c.status === "ACTIVE" ? "⏸ Tắt" : "▶️ Bật") : "" },
    { title: "Mục tiêu", value: c => c.objective },
    { title: "Ngân sách", num: true, value: c => c.daily_budget ? `${money(c.daily_budget, cur)}/ngày` : c.lifetime_budget ? `${money(c.lifetime_budget, cur)} trọn đời` : "Nhóm QC" },
    { title: "Chi tiêu", num: true, value: c => { const s = c.insights?.data?.[0]?.spend; return s ? `${fmtNum(s, 2)} ${cur}` : "0"; } },
    { title: "Hiển thị", num: true, value: c => fmtNum(c.insights?.data?.[0]?.impressions || 0) },
    { title: "Click", num: true, value: c => fmtNum(c.insights?.data?.[0]?.clicks || 0) },
    { title: "CTR", num: true, value: c => { const v = c.insights?.data?.[0]?.ctr; return v ? `${fmtNum(v, 2)}%` : ""; } },
    { title: "CPC", num: true, value: c => fmtNum(c.insights?.data?.[0]?.cpc, 2) },
    { title: "Ngày tạo", value: c => fmtDate(c.created_time) },
  ];
  renderTable($("#campTable"), cols, state.campaigns, { empty: "Chọn tài khoản và bấm “Tải chiến dịch”" });
}

async function toggleCampaign(c, btn) {
  const next = c.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
  btn.disabled = true;
  try {
    await Graph.request(c.id, { status: next }, "POST");
    c.status = next; c.effective_status = next;
    toast(`${next === "ACTIVE" ? "Đã bật" : "Đã tắt"}: ${c.name}`);
  } catch (e) { toast(e.message, true); }
  renderCampaigns();
}

async function bulkStatus(status) {
  const ids = [...state.selectedCamps];
  if (!ids.length) throw new Error("Chưa chọn chiến dịch nào");
  const res = await Graph.batch(ids.map(id => ({ method: "POST", relative_url: id, body: `status=${status}` })));
  const fails = res.filter(r => r.error).length;
  toast(`Thành công ${ids.length - fails}/${ids.length}`, fails > 0);
  await loadCampaigns();
}

busy($("#btnLoadCamp"), loadCampaigns);
busy($("#btnPauseSel"), () => bulkStatus("PAUSED"));
busy($("#btnActiveSel"), () => bulkStatus("ACTIVE"));
$("#btnExportCamp").addEventListener("click", () => {
  const cur = campCurrency();
  downloadCsv(`chien-dich-${Date.now()}.csv`,
    ["Tên", "ID", "Trạng thái", "Mục tiêu", "NS ngày", "NS trọn đời", "Chi tiêu", "Hiển thị", "Click", "CTR", "CPC"],
    state.campaigns.map(c => { const i = c.insights?.data?.[0] || {}; return [c.name, c.id, c.effective_status, c.objective,
      money(c.daily_budget, cur), money(c.lifetime_budget, cur), i.spend || 0, i.impressions || 0, i.clicks || 0, i.ctr || "", i.cpc || ""]; }));
});

/* ------------------------------ Business Manager ------------------------------ */

const VERIFY = {
  verified: ["Đã xác minh", "ok"], not_verified: ["Chưa xác minh", "neutral"],
  pending: ["Đang chờ", "warn"], pending_submission: ["Chờ gửi", "warn"],
  pending_need_more_info: ["Cần bổ sung", "warn"], rejected: ["Bị từ chối", "bad"],
  revoked: ["Bị thu hồi", "bad"], expired: ["Hết hạn", "bad"],
};

async function loadBms() {
  const bms = await Graph.all("me/businesses", { fields: "id,name,verification_status,created_time,primary_page{name}" });
  // Đếm số TK/Page mỗi BM (lỗi quyền ở một BM không làm hỏng cả danh sách).
  const edges = ["owned_ad_accounts", "client_ad_accounts", "owned_pages"];
  const res = await Graph.batch(bms.flatMap(b => edges.map(e => ({ method: "GET", relative_url: `${b.id}/${e}?limit=0&summary=true` }))));
  bms.forEach((b, i) => edges.forEach((e, j) => { b[e] = res[i * edges.length + j]?.summary?.total_count; }));
  state.bms = bms;
  await store.set("bms", bms);
  renderBms(); updateStats();
  toast(`Đã tải ${bms.length} BM`);
}

function renderBms() {
  renderTable($("#bmTable"), [
    { title: "Tên BM", value: b => b.name },
    { title: "ID", value: b => b.id },
    { title: "Xác minh", value: b => { const [l, k] = VERIFY[b.verification_status] || [b.verification_status || "", "neutral"]; return badge(l, k); } },
    { title: "TK QC sở hữu", num: true, value: b => b.owned_ad_accounts ?? "?" },
    { title: "TK QC đối tác", num: true, value: b => b.client_ad_accounts ?? "?" },
    { title: "Page sở hữu", num: true, value: b => b.owned_pages ?? "?" },
    { title: "Page chính", value: b => b.primary_page?.name || "" },
    { title: "Ngày tạo", value: b => fmtDate(b.created_time) },
    { title: "", value: b => h("a", { href: `https://business.facebook.com/settings/?business_id=${b.id}`, target: "_blank", rel: "noopener" }, "Mở BM") },
  ], state.bms, { empty: "Bấm “Tải BM” để lấy danh sách", onRowClick: showBmDetail });
}

async function showBmDetail(b) {
  const box = $("#bmDetail");
  box.replaceChildren(h("p", { class: "muted" }, `Đang tải tài khoản của ${b.name}…`));
  try {
    const accs = await Graph.all(`${b.id}/owned_ad_accounts`, { fields: "name,account_id,account_status,currency,amount_spent,spend_cap" });
    const table = h("table");
    box.replaceChildren(h("h3", { style: "margin-top:16px" }, `TK QC sở hữu bởi ${b.name} (${accs.length})`), h("div", { class: "table-wrap" }, table));
    renderTable(table, [
      { title: "Tên", value: a => a.name },
      { title: "ID", value: a => a.account_id },
      { title: "Trạng thái", value: accStatusBadge },
      { title: "Đã chi tiêu", num: true, value: a => money(a.amount_spent, a.currency) },
      { title: "Giới hạn chi", num: true, value: a => Number(a.spend_cap) ? money(a.spend_cap, a.currency) : "Không" },
    ], accs);
  } catch (e) {
    box.replaceChildren(h("p", {}, badge("Lỗi", "bad"), " ", e.message));
  }
}

busy($("#btnLoadBm"), loadBms);
$("#btnExportBm").addEventListener("click", () => downloadCsv(`bm-${Date.now()}.csv`,
  ["Tên", "ID", "Xác minh", "TK sở hữu", "TK đối tác", "Page sở hữu", "Ngày tạo"],
  state.bms.map(b => [b.name, b.id, b.verification_status, b.owned_ad_accounts, b.client_ad_accounts, b.owned_pages, b.created_time])));

/* ------------------------------ Fanpage ------------------------------ */

async function loadPages() {
  state.pages = await Graph.all("me/accounts", { fields: "id,name,category,fan_count,followers_count,link,tasks" });
  await store.set("pages", state.pages);
  renderPages(); updateStats();
  toast(`Đã tải ${state.pages.length} Fanpage`);
}

function filteredPages() {
  const q = $("#pageSearch").value.trim().toLowerCase();
  return state.pages.filter(p => !q || p.name?.toLowerCase().includes(q) || p.id.includes(q));
}

function renderPages() {
  renderTable($("#pageTable"), [
    { title: "Tên Page", value: p => p.name },
    { title: "ID", value: p => p.id },
    { title: "Danh mục", value: p => p.category },
    { title: "Lượt thích", num: true, value: p => fmtNum(p.fan_count) },
    { title: "Theo dõi", num: true, value: p => fmtNum(p.followers_count) },
    { title: "Quyền", value: p => (p.tasks || []).join(", ") },
    { title: "", value: p => h("a", { href: p.link || `https://facebook.com/${p.id}`, target: "_blank", rel: "noopener" }, "Mở") },
  ], filteredPages(), { empty: "Bấm “Tải Fanpage” để lấy danh sách" });
}

busy($("#btnLoadPages"), loadPages);
$("#pageSearch").addEventListener("input", renderPages);
$("#btnCopyPageIds").addEventListener("click", () => copyText(filteredPages().map(p => p.id).join("\n")));
$("#btnExportPages").addEventListener("click", () => downloadCsv(`fanpage-${Date.now()}.csv`,
  ["Tên", "ID", "Danh mục", "Lượt thích", "Theo dõi", "Quyền", "Link"],
  filteredPages().map(p => [p.name, p.id, p.category, p.fan_count, p.followers_count, (p.tasks || []).join(" "), p.link])));

busy($("#btnReloadAll"), async () => {
  await loadAccounts();
  await loadBms().catch(e => toast("BM: " + e.message, true));
  await loadPages().catch(e => toast("Page: " + e.message, true));
});

/* ------------------------------ Lấy ID từ link ------------------------------ */

// Trả về { type, id } nếu tìm được ID số trực tiếp trong link, ngược lại { type, username }.
function parseFbLink(raw) {
  const s = raw.trim();
  if (/^\d{5,}$/.test(s)) return { type: "ID", id: s };
  let u;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return null; }
  if (!/(^|\.)(facebook\.com|fb\.com|fb\.me)$/i.test(u.hostname)) return null;
  const p = u.searchParams;
  const parts = u.pathname.split("/").filter(Boolean);
  if (p.get("story_fbid") && p.get("id")) return { type: "Bài viết", id: `${p.get("id")}_${p.get("story_fbid")}` };
  if (p.get("fbid")) return { type: "Ảnh", id: p.get("fbid") };
  if (p.get("id")) return { type: "Profile", id: p.get("id") };
  if (parts[0] === "groups" && parts[1]) {
    if (parts[2] === "posts" || parts[2] === "permalink") return { type: "Bài viết nhóm", id: parts[3], group: parts[1] };
    return /^\d+$/.test(parts[1]) ? { type: "Nhóm", id: parts[1] } : { type: "Nhóm", username: parts[1] };
  }
  if ((parts[0] === "pages" || parts[0] === "people") && parts.length >= 3 && /^\d+$/.test(parts[2])) return { type: parts[0] === "pages" ? "Page" : "Profile", id: parts[2] };
  if (parts[1] === "posts" || parts[1] === "videos") return { type: parts[1] === "posts" ? "Bài viết" : "Video", id: parts[2], owner: parts[0] };
  if (parts[0] === "watch" && p.get("v")) return { type: "Video", id: p.get("v") };
  if (parts[0] === "reel" && parts[1]) return { type: "Reel", id: parts[1] };
  if (parts[0]) {
    const m = parts[0].match(/-(\d{6,})$/);
    if (m) return { type: "Page", id: m[1] };
    return /^\d+$/.test(parts[0]) ? { type: "ID", id: parts[0] } : { type: "Username", username: parts[0] };
  }
  return null;
}

let idResults = [];
busy($("#btnFindId"), async () => {
  const lines = $("#idInput").value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  idResults = [];
  for (const line of lines) {
    const r = parseFbLink(line);
    if (!r) { idResults.push({ link: line, type: "", id: "", note: "Link không hợp lệ" }); continue; }
    if (r.id) { idResults.push({ link: line, type: r.type, id: r.id, note: "" }); continue; }
    if (!Graph.token) { idResults.push({ link: line, type: r.type, id: "", note: "Cần token để tra username" }); continue; }
    try {
      const d = await Graph.request(r.username, { fields: "id,name" });
      idResults.push({ link: line, type: r.type, id: d.id, note: d.name || "" });
    } catch (e) {
      idResults.push({ link: line, type: r.type, id: "", note: e.message });
    }
  }
  renderTable($("#idTable"), [
    { title: "Link", value: r => r.link },
    { title: "Loại", value: r => r.type },
    { title: "ID", value: r => r.id ? h("b", {}, r.id) : "" },
    { title: "Ghi chú", value: r => r.note },
  ], idResults);
});
$("#btnCopyIds").addEventListener("click", () => copyText(idResults.map(r => r.id).filter(Boolean).join("\n")));

/* ------------------------------ Xử lý văn bản ------------------------------ */

const lines = (s) => s.split(/\r?\n/);
const uniq = (arr) => [...new Set(arr)];
const textOps = {
  dedupe: (t) => uniq(lines(t)).join("\n"),
  trim: (t) => lines(t).map(l => l.trim()).filter(Boolean).join("\n"),
  sort: (t) => lines(t).sort((a, b) => a.localeCompare(b, "vi", { numeric: true })).join("\n"),
  shuffle: (t) => { const a = lines(t); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.join("\n"); },
  reverse: (t) => lines(t).reverse().join("\n"),
  uids: (t) => uniq(t.match(/\b\d{8,20}\b/g) || []).join("\n"),
  emails: (t) => uniq(t.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []).join("\n"),
  phones: (t) => uniq(t.match(/(?<![\d+])(?:\+?84|0)(?:[\s.-]?\d){9}\b/g) || []).map(p => p.replace(/[\s.-]/g, "")).join("\n"),
  links: (t) => uniq(t.match(/https?:\/\/[^\s"'<>]+/g) || []).join("\n"),
  join: (t) => lines(t).filter(Boolean).join($("#joinSep").value.replace(/\\n/g, "\n").replace(/\\t/g, "\t")),
  column: (t) => {
    const sep = $("#splitSep").value || "|";
    const col = Math.max(1, Number($("#splitCol").value) || 1) - 1;
    return lines(t).map(l => l.split(sep)[col] ?? "").join("\n");
  },
  chunk: (t) => {
    const n = Math.max(1, Number($("#chunkSize").value) || 100);
    const a = lines(t).filter(Boolean);
    const out = [];
    for (let i = 0; i < a.length; i += n) out.push(`===== Nhóm ${i / n + 1} (${Math.min(n, a.length - i)} dòng) =====`, ...a.slice(i, i + n), "");
    return out.join("\n");
  },
};

function countLines(s) { return s ? lines(s).filter(Boolean).length : 0; }
function updateTextCounts() {
  $("#inCount").textContent = `(${countLines($("#txtIn").value)} dòng)`;
  $("#outCount").textContent = `(${countLines($("#txtOut").value)} dòng)`;
}
$$("#tab-text [data-op]").forEach(b => b.addEventListener("click", () => {
  $("#txtOut").value = textOps[b.dataset.op]($("#txtIn").value);
  updateTextCounts();
}));
$("#txtIn").addEventListener("input", updateTextCounts);
$("#btnOutToIn").addEventListener("click", () => { $("#txtIn").value = $("#txtOut").value; $("#txtOut").value = ""; updateTextCounts(); });
$("#btnCopyOut").addEventListener("click", () => copyText($("#txtOut").value));

/* ------------------------------ Email tạm (mail.tm) ------------------------------ */

const MAIL_API = "https://api.mail.tm";
let mailAcc = null;
let mailTimer = null;

async function mailFetch(path, opts = {}) {
  const headers = { Accept: "application/json", ...(opts.body ? { "Content-Type": "application/json" } : {}) };
  if (mailAcc?.token) headers.Authorization = `Bearer ${mailAcc.token}`;
  const res = await fetch(MAIL_API + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || `mail.tm lỗi HTTP ${res.status}`);
  return Array.isArray(data) ? data : (data["hydra:member"] ?? data);
}

function randStr(n) {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), x => c[x % c.length]).join("");
}

busy($("#btnNewMail"), async () => {
  const domains = await mailFetch("/domains");
  const domain = domains.find(d => d.isActive !== false)?.domain;
  if (!domain) throw new Error("Không lấy được domain email");
  const address = `${randStr(10)}@${domain}`;
  const password = randStr(16);
  mailAcc = null;
  await mailFetch("/accounts", { method: "POST", body: JSON.stringify({ address, password }) });
  const { token } = await mailFetch("/token", { method: "POST", body: JSON.stringify({ address, password }) });
  mailAcc = { address, password, token };
  await store.set("mailAcc", mailAcc);
  $("#mailAddr").value = address;
  $("#mailView").replaceChildren(h("span", { class: "muted" }, "Chọn một thư để xem."));
  await refreshMail();
  toast("Đã tạo email mới");
});

function extractOtp(text) {
  return (text || "").match(/\b\d{4,8}\b/)?.[0] || "";
}

async function refreshMail() {
  if (!mailAcc) throw new Error("Chưa tạo email");
  const msgs = await mailFetch("/messages");
  renderTable($("#mailTable"), [
    { title: "Từ", value: m => m.from?.name || m.from?.address },
    { title: "Tiêu đề", value: m => m.subject },
    { title: "OTP", value: m => { const o = extractOtp(`${m.subject} ${m.intro}`); return o ? h("span", { class: "otp", style: "font-size:14px" }, o) : ""; } },
    { title: "Thời gian", value: m => fmtDate(m.createdAt) },
  ], msgs, { empty: "Hộp thư trống", onRowClick: openMail });
}

async function openMail(m) {
  const full = await mailFetch(`/messages/${m.id}`);
  const otp = extractOtp(`${full.subject} ${full.text}`);
  $("#mailView").replaceChildren(
    h("h3", {}, full.subject || "(Không tiêu đề)"),
    h("p", { class: "muted" }, `Từ: ${full.from?.name || ""} <${full.from?.address || ""}> — ${fmtDate(full.createdAt)}`),
    otp ? h("p", {}, "Mã OTP: ", h("span", { class: "otp" }, otp), " ", h("button", { class: "small", onclick: () => copyText(otp) }, "Copy")) : "",
    h("div", { class: "mail-body" }, full.text || "(Thư không có nội dung văn bản)"),
  );
}

busy($("#btnRefreshMail"), refreshMail);
$("#btnCopyMail").addEventListener("click", () => mailAcc && copyText(mailAcc.address));
$("#mailAuto").addEventListener("change", (e) => {
  clearInterval(mailTimer);
  if (e.target.checked) mailTimer = setInterval(() => mailAcc && refreshMail().catch(() => {}), 5000);
});

/* ------------------------------ TOTP 2FA ------------------------------ */

function base32Decode(s) {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = s.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0, val = 0;
  const out = [];
  for (const ch of clean) {
    const i = alpha.indexOf(ch);
    if (i < 0) throw new Error("Khoá không hợp lệ");
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(out);
}

async function totp(secret, step = 30, digits = 6) {
  const key = await crypto.subtle.importKey("raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const counter = Math.floor(Date.now() / 1000 / step);
  const buf = new ArrayBuffer(8);
  new DataView(buf).setUint32(4, counter);
  new DataView(buf).setUint32(0, Math.floor(counter / 2 ** 32));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
  const off = sig[sig.length - 1] & 0xf;
  const code = ((sig[off] & 0x7f) << 24 | sig[off + 1] << 16 | sig[off + 2] << 8 | sig[off + 3]) % 10 ** digits;
  return String(code).padStart(digits, "0");
}

async function renderTotp() {
  const entries = $("#totpInput").value.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(l => {
    const i = l.lastIndexOf("|");
    return i >= 0 ? { label: l.slice(0, i), secret: l.slice(i + 1) } : { label: "", secret: l };
  });
  const rows = await Promise.all(entries.map(async e => {
    try { return { ...e, code: await totp(e.secret) }; } catch (err) { return { ...e, code: "", err: err.message }; }
  }));
  const remain = 30 - Math.floor(Date.now() / 1000) % 30;
  renderTable($("#totpTable"), [
    { title: "Ghi chú", value: r => r.label },
    { title: "Mã", value: r => r.err ? badge(r.err, "bad") : h("span", { class: "otp" }, r.code) },
    { title: "Còn lại", value: () => h("span", {}, h("span", { class: "progress" }, h("div", { style: `width:${remain / 30 * 100}%` })), ` ${remain}s`) },
    { title: "", value: r => r.code ? h("button", { class: "small", onclick: () => copyText(r.code) }, "Copy") : "" },
  ], rows, { empty: "Nhập khoá 2FA ở trên" });
}

$("#totpInput").addEventListener("input", () => {
  renderTotp();
  if ($("#totpSave").checked) store.set("totp", $("#totpInput").value);
});
$("#totpSave").addEventListener("change", (e) => {
  if (e.target.checked) store.set("totp", $("#totpInput").value);
  else store.remove("totp");
});
setInterval(() => { if ($("#tab-totp").classList.contains("active") && $("#totpInput").value.trim()) renderTotp(); }, 1000);

/* ------------------------------ Khởi động ------------------------------ */

(async function init() {
  await Graph.init();
  $("#tokenInput").value = Graph.token;
  $("#apiVersion").value = Graph.version;
  state.accounts = await store.get("accounts", []);
  state.bms = await store.get("bms", []);
  state.pages = await store.get("pages", []);
  mailAcc = await store.get("mailAcc");
  if (mailAcc) $("#mailAddr").value = mailAcc.address;
  const savedTotp = await store.get("totp");
  if (savedTotp) { $("#totpInput").value = savedTotp; $("#totpSave").checked = true; }
  renderAccounts(); fillCampAccounts(); renderCampaigns(); renderBms(); renderPages(); renderTotp();
  updateStats(); updateTextCounts(); renderUser();
  showTab(await store.get("lastTab", "dashboard"));
})();
