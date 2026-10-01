"""Telegram bot báo cáo chi tiêu quảng cáo Facebook hàng ngày."""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta

from telegram import BotCommand, Update
from telegram.constants import ParseMode
from telegram.ext import Application, CommandHandler, ContextTypes

from .config import Config, ConfigError, load_config
from .facebook import AccountReport, FacebookAdsClient
from .report import format_report, split_message

logging.basicConfig(format="%(asctime)s %(levelname)s %(name)s: %(message)s", level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("fb_ads_bot")

HELP_TEXT = (
    "🤖 <b>Bot báo cáo chi tiêu quảng cáo Facebook</b>\n\n"
    "/homnay – Chi tiêu hôm nay (tính đến hiện tại)\n"
    "/homqua – Báo cáo ngày hôm qua\n"
    "/ngay DD/MM/YYYY – Báo cáo một ngày cụ thể\n"
    "/tuan – 7 ngày gần nhất\n"
    "/thang – Từ đầu tháng đến hôm nay\n"
    "/chatid – Xem chat ID hiện tại\n\n"
    "Báo cáo tự động được gửi mỗi ngày lúc {time}."
)


async def build_report(cfg: Config, title: str, since: date, until: date, compare: bool = True) -> list[str]:
    client = FacebookAdsClient(cfg.fb_access_token, cfg.fb_api_version)

    # So sánh với khoảng thời gian liền trước có cùng độ dài
    length = (until - since).days + 1
    prev_until = since - timedelta(days=1)
    prev_since = prev_until - timedelta(days=length - 1)

    results = await asyncio.gather(
        *(
            client.account_report(
                acc,
                since,
                until,
                prev_since if compare else None,
                prev_until if compare else None,
            )
            for acc in cfg.fb_ad_account_ids
        ),
        return_exceptions=True,
    )

    reports: list[AccountReport] = []
    errors: list[str] = []
    for acc, res in zip(cfg.fb_ad_account_ids, results):
        if isinstance(res, Exception):
            log.exception("Lỗi khi lấy dữ liệu %s", acc, exc_info=res)
            errors.append(f"{acc}: {res}")
        else:
            reports.append(res)

    text = format_report(title, since, until, reports, errors, cfg.top_campaigns)
    return split_message(text)


def _cfg(context: ContextTypes.DEFAULT_TYPE) -> Config:
    return context.application.bot_data["config"]


def _today(cfg: Config) -> date:
    return datetime.now(cfg.timezone).date()


def _authorized(update: Update, cfg: Config) -> bool:
    return update.effective_chat is not None and update.effective_chat.id in cfg.chat_ids


async def _reply_report(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    title: str,
    since: date,
    until: date,
    compare: bool = True,
):
    cfg = _cfg(context)
    if not _authorized(update, cfg):
        await update.effective_message.reply_text("⛔ Chat này chưa được cấp quyền. Thêm chat ID vào TELEGRAM_CHAT_IDS.")
        return
    waiting = await update.effective_message.reply_text("⏳ Đang lấy dữ liệu từ Facebook...")
    try:
        for chunk in await build_report(cfg, title, since, until, compare):
            await update.effective_message.reply_text(chunk, parse_mode=ParseMode.HTML)
    except Exception as exc:  # noqa: BLE001 - báo lỗi cho người dùng thay vì im lặng
        log.exception("Không tạo được báo cáo")
        await update.effective_message.reply_text(f"❌ Lỗi: {exc}")
    finally:
        await waiting.delete()


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    cfg = _cfg(context)
    await update.effective_message.reply_text(
        HELP_TEXT.format(time=cfg.report_time.strftime("%H:%M")), parse_mode=ParseMode.HTML
    )


async def cmd_chatid(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.effective_message.reply_text(
        f"Chat ID: <code>{update.effective_chat.id}</code>", parse_mode=ParseMode.HTML
    )


async def cmd_today(update: Update, context: ContextTypes.DEFAULT_TYPE):
    today = _today(_cfg(context))
    # Hôm nay chưa hết ngày nên không so sánh với hôm qua
    await _reply_report(update, context, "Chi tiêu quảng cáo hôm nay (tạm tính)", today, today, compare=False)


async def cmd_yesterday(update: Update, context: ContextTypes.DEFAULT_TYPE):
    day = _today(_cfg(context)) - timedelta(days=1)
    await _reply_report(update, context, "Báo cáo chi tiêu quảng cáo hôm qua", day, day)


async def cmd_day(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        day = datetime.strptime(context.args[0], "%d/%m/%Y").date()
    except (IndexError, ValueError):
        await update.effective_message.reply_text("Cú pháp: /ngay DD/MM/YYYY, ví dụ /ngay 25/09/2026")
        return
    await _reply_report(update, context, "Báo cáo chi tiêu quảng cáo", day, day)


async def cmd_week(update: Update, context: ContextTypes.DEFAULT_TYPE):
    until = _today(_cfg(context)) - timedelta(days=1)
    await _reply_report(update, context, "Báo cáo 7 ngày gần nhất", until - timedelta(days=6), until)


async def cmd_month(update: Update, context: ContextTypes.DEFAULT_TYPE):
    today = _today(_cfg(context))
    await _reply_report(update, context, "Báo cáo từ đầu tháng", today.replace(day=1), today)


async def daily_job(context: ContextTypes.DEFAULT_TYPE):
    cfg = _cfg(context)
    day = _today(cfg) - timedelta(days=1)
    log.info("Gửi báo cáo hàng ngày cho %s", day)
    try:
        chunks = await build_report(cfg, "Báo cáo chi tiêu quảng cáo hàng ngày", day, day)
    except Exception as exc:  # noqa: BLE001
        log.exception("Không tạo được báo cáo hàng ngày")
        chunks = [f"❌ Không tạo được báo cáo hàng ngày: {exc}"]

    for chat_id in cfg.chat_ids:
        for chunk in chunks:
            try:
                await context.bot.send_message(chat_id, chunk, parse_mode=ParseMode.HTML)
            except Exception:  # noqa: BLE001
                log.exception("Không gửi được tới chat %s", chat_id)


async def post_init(app: Application):
    await app.bot.set_my_commands(
        [
            BotCommand("homnay", "Chi tiêu hôm nay"),
            BotCommand("homqua", "Báo cáo hôm qua"),
            BotCommand("ngay", "Báo cáo ngày cụ thể (DD/MM/YYYY)"),
            BotCommand("tuan", "7 ngày gần nhất"),
            BotCommand("thang", "Từ đầu tháng"),
            BotCommand("chatid", "Xem chat ID"),
        ]
    )


def main():
    try:
        cfg = load_config()
    except ConfigError as exc:
        raise SystemExit(f"Lỗi cấu hình: {exc}")

    app = Application.builder().token(cfg.telegram_token).post_init(post_init).build()
    app.bot_data["config"] = cfg

    app.add_handler(CommandHandler(["start", "help"], cmd_start))
    app.add_handler(CommandHandler("chatid", cmd_chatid))
    app.add_handler(CommandHandler("homnay", cmd_today))
    app.add_handler(CommandHandler("homqua", cmd_yesterday))
    app.add_handler(CommandHandler("ngay", cmd_day))
    app.add_handler(CommandHandler("tuan", cmd_week))
    app.add_handler(CommandHandler("thang", cmd_month))

    app.job_queue.run_daily(daily_job, time=cfg.report_time, name="daily_report")
    log.info(
        "Bot đã chạy. Báo cáo hàng ngày lúc %s (%s) cho %d tài khoản.",
        cfg.report_time.strftime("%H:%M"),
        cfg.timezone.key,
        len(cfg.fb_ad_account_ids),
    )
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
