"""Đọc cấu hình từ biến môi trường / file .env."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import time
from zoneinfo import ZoneInfo

from dotenv import load_dotenv


class ConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class Config:
    telegram_token: str
    chat_ids: tuple[int, ...]
    fb_access_token: str
    fb_ad_account_ids: tuple[str, ...]
    fb_api_version: str
    report_time: time
    timezone: ZoneInfo
    top_campaigns: int


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ConfigError(f"Thiếu biến môi trường bắt buộc: {name}")
    return value


def _split(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def normalize_account_id(account_id: str) -> str:
    return account_id if account_id.startswith("act_") else f"act_{account_id}"


def load_config() -> Config:
    load_dotenv()

    try:
        chat_ids = tuple(int(c) for c in _split(_required("TELEGRAM_CHAT_IDS")))
    except ValueError as exc:
        raise ConfigError("TELEGRAM_CHAT_IDS phải là các số nguyên, cách nhau bởi dấu phẩy") from exc

    accounts = tuple(normalize_account_id(a) for a in _split(_required("FB_AD_ACCOUNT_IDS")))
    if not accounts:
        raise ConfigError("FB_AD_ACCOUNT_IDS không được để trống")

    tz = ZoneInfo(os.getenv("TIMEZONE", "Asia/Ho_Chi_Minh"))

    raw_time = os.getenv("REPORT_TIME", "08:00")
    try:
        hour, minute = (int(p) for p in raw_time.split(":"))
        report_time = time(hour, minute, tzinfo=tz)
    except ValueError as exc:
        raise ConfigError(f"REPORT_TIME không hợp lệ: {raw_time!r} (định dạng HH:MM)") from exc

    return Config(
        telegram_token=_required("TELEGRAM_BOT_TOKEN"),
        chat_ids=chat_ids,
        fb_access_token=_required("FB_ACCESS_TOKEN"),
        fb_ad_account_ids=accounts,
        fb_api_version=os.getenv("FB_API_VERSION", "v21.0"),
        report_time=report_time,
        timezone=tz,
        top_campaigns=int(os.getenv("TOP_CAMPAIGNS", "5")),
    )
