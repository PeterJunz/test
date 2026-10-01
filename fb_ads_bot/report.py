"""Định dạng báo cáo chi tiêu thành tin nhắn Telegram (HTML)."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from html import escape

from .facebook import AccountReport, Insights

ZERO_DECIMAL_CURRENCIES = {"VND", "JPY", "KRW", "IDR", "CLP", "TWD", "HUF", "ISK", "PYG", "COP"}
CURRENCY_SYMBOLS = {"VND": "₫", "USD": "$", "EUR": "€", "JPY": "¥", "THB": "฿"}

# Các loại kết quả hay dùng -> nhãn hiển thị. Lấy loại đầu tiên tìm thấy trong mỗi nhóm.
RESULT_TYPES: list[tuple[str, tuple[str, ...]]] = [
    ("Tin nhắn", ("onsite_conversion.messaging_conversation_started_7d",)),
    ("Khách hàng tiềm năng", ("lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead")),
    ("Mua hàng", ("purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase")),
]

TELEGRAM_LIMIT = 4000


def fmt_number(value: float, decimals: int = 0) -> str:
    """Định dạng kiểu Việt Nam: 1.234.567,89"""
    text = f"{value:,.{decimals}f}"
    return text.replace(",", "_").replace(".", ",").replace("_", ".")


def fmt_money(amount: float, currency: str) -> str:
    decimals = 0 if currency in ZERO_DECIMAL_CURRENCIES else 2
    symbol = CURRENCY_SYMBOLS.get(currency)
    number = fmt_number(amount, decimals)
    return f"{number} {symbol}" if symbol else f"{number} {currency}"


def fmt_change(current: float, previous: float) -> str:
    if previous <= 0:
        return "" if current <= 0 else " (🆕)"
    pct = (current - previous) / previous * 100
    arrow = "🔺" if pct > 0 else "🔻" if pct < 0 else "➖"
    return f" ({arrow} {fmt_number(abs(pct), 1)}%)"


def fmt_period(since: date, until: date) -> str:
    if since == until:
        return since.strftime("%d/%m/%Y")
    return f"{since.strftime('%d/%m/%Y')} – {until.strftime('%d/%m/%Y')}"


def key_results(insights: Insights) -> list[tuple[str, float]]:
    results = []
    for label, types in RESULT_TYPES:
        for action_type in types:
            if insights.actions.get(action_type):
                results.append((label, insights.actions[action_type]))
                break
    return results


def format_account(report: AccountReport, top_campaigns: int) -> str:
    t, cur = report.totals, report.currency
    lines = [f"📊 <b>{escape(report.name)}</b> <code>{report.account_id}</code>"]

    spend_line = f"💰 Chi tiêu: <b>{fmt_money(t.spend, cur)}</b>"
    if report.previous_totals is not None:
        spend_line += fmt_change(t.spend, report.previous_totals.spend)
    lines.append(spend_line)

    if t.spend <= 0 and t.impressions == 0:
        lines.append("<i>Không có chi tiêu trong khoảng thời gian này.</i>")
        return "\n".join(lines)

    lines.append(f"👁 Hiển thị: {fmt_number(t.impressions)} · Tiếp cận: {fmt_number(t.reach)}")
    lines.append(f"🖱 Click: {fmt_number(t.clicks)} · CTR: {fmt_number(t.ctr, 2)}%")
    lines.append(f"💵 CPC: {fmt_money(t.cpc, cur)} · CPM: {fmt_money(t.cpm, cur)}")

    for label, value in key_results(t):
        cost = fmt_money(t.spend / value, cur) if value else "-"
        lines.append(f"🎯 {label}: {fmt_number(value)} · Chi phí/kết quả: {cost}")

    active = [c for c in report.campaigns if c.insights.spend > 0]
    if active and top_campaigns > 0:
        lines.append("")
        lines.append(f"🏆 <b>Top {min(top_campaigns, len(active))} chiến dịch</b>")
        for i, c in enumerate(active[:top_campaigns], 1):
            line = f"{i}. {escape(c.name)} — {fmt_money(c.insights.spend, cur)}"
            results = key_results(c.insights)
            if results:
                label, value = results[0]
                line += f" · {fmt_number(value)} {label.lower()}"
            lines.append(line)
        if len(active) > top_campaigns:
            rest = sum(c.insights.spend for c in active[top_campaigns:])
            lines.append(f"… và {len(active) - top_campaigns} chiến dịch khác: {fmt_money(rest, cur)}")

    return "\n".join(lines)


def format_report(
    title: str,
    since: date,
    until: date,
    reports: list[AccountReport],
    errors: list[str],
    top_campaigns: int,
) -> str:
    parts = [f"<b>{escape(title)}</b>\n🗓 {fmt_period(since, until)}"]
    parts.extend(format_account(r, top_campaigns) for r in reports)

    if len(reports) > 1:
        by_currency: dict[str, float] = defaultdict(float)
        for r in reports:
            by_currency[r.currency] += r.totals.spend
        totals = " + ".join(fmt_money(v, c) for c, v in by_currency.items())
        parts.append(f"🧾 <b>Tổng chi tiêu tất cả tài khoản: {totals}</b>")

    if errors:
        parts.append("⚠️ <b>Lỗi:</b>\n" + "\n".join(f"• {escape(e)}" for e in errors))

    return "\n\n".join(parts)


def split_message(text: str, limit: int = TELEGRAM_LIMIT) -> list[str]:
    """Chia tin nhắn dài theo dòng để không vượt giới hạn của Telegram."""
    chunks, current = [], ""
    for line in text.split("\n"):
        candidate = f"{current}\n{line}" if current else line
        if len(candidate) > limit and current:
            chunks.append(current)
            current = line[:limit]
        else:
            current = candidate[:limit]
    if current:
        chunks.append(current)
    return chunks
