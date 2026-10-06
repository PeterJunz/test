// Tiện ích dùng chung: DOM, storage, CSV, clipboard, toast.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Tạo phần tử DOM an toàn (luôn dùng textContent, không dùng innerHTML với dữ liệu ngoài).
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "checked" || k === "value") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const store = {
  async get(key, def = null) {
    const r = await chrome.storage.local.get(key);
    return r[key] ?? def;
  },
  set(key, val) { return chrome.storage.local.set({ [key]: val }); },
  remove(key) { return chrome.storage.local.remove(key); },
};

let toastTimer;
function toast(msg, isError = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast" + (isError ? " error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), isError ? 6000 : 2500);
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
  toast(`Đã copy ${text.split("\n").filter(Boolean).length} dòng`);
}

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename, headers, rows) {
  const lines = [headers.map(csvCell).join(","), ...rows.map(r => r.map(csvCell).join(","))];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = h("a", { href: URL.createObjectURL(blob), download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Bọc handler của nút: khoá nút khi chạy và báo lỗi bằng toast.
function busy(btn, fn) {
  btn.addEventListener("click", async (e) => {
    if (btn.disabled) return;
    btn.disabled = true;
    try { await fn(e); }
    catch (err) { console.error(err); toast(err.message || String(err), true); }
    finally { btn.disabled = false; }
  });
}

// Render bảng: columns = [{ title, value(row) -> string|Node, num?, sort?(row) }]
function renderTable(table, columns, rows, opts = {}) {
  table.replaceChildren();
  const thead = h("thead", {}, h("tr", {}, columns.map(c => h("th", {}, c.title))));
  const tbody = h("tbody");
  if (!rows.length) {
    tbody.append(h("tr", {}, h("td", { colspan: columns.length, class: "empty" }, opts.empty || "Không có dữ liệu")));
  }
  for (const row of rows) {
    const tr = h("tr", { class: opts.onRowClick ? "clickable" : null },
      columns.map(c => h("td", { class: c.num ? "num" : null }, c.value(row) ?? "")));
    if (opts.onRowClick) tr.addEventListener("click", (e) => {
      if (e.target.closest("button, input, a")) return;
      opts.onRowClick(row);
    });
    tbody.append(tr);
  }
  table.append(thead, tbody);
}

function badge(text, kind = "neutral") { return h("span", { class: `badge ${kind}` }, text); }

function fmtNum(n, digits = 0) {
  if (n == null || n === "" || isNaN(n)) return "";
  return Number(n).toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

function fmtDate(s) {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleString("vi-VN");
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
