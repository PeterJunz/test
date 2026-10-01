from datetime import date

from fb_ads_bot.config import normalize_account_id
from fb_ads_bot.facebook import AccountReport, CampaignInsights, Insights
from fb_ads_bot.report import fmt_change, fmt_money, format_report, split_message


def _insights(spend, messages=0):
    row = {"spend": str(spend), "impressions": "10000", "reach": "8000", "clicks": "250",
           "ctr": "2.5", "cpc": "2000", "cpm": "50000"}
    if messages:
        row["actions"] = [{"action_type": "onsite_conversion.messaging_conversation_started_7d",
                           "value": str(messages)}]
    return Insights.from_row(row)


def test_fmt_money():
    assert fmt_money(1234567, "VND") == "1.234.567 ₫"
    assert fmt_money(1234.5, "USD") == "1.234,50 $"
    assert fmt_money(10, "SGD") == "10,00 SGD"


def test_fmt_change():
    assert fmt_change(150, 100) == " (🔺 50,0%)"
    assert fmt_change(50, 100) == " (🔻 50,0%)"
    assert fmt_change(0, 0) == ""
    assert fmt_change(10, 0) == " (🆕)"


def test_normalize_account_id():
    assert normalize_account_id("123") == "act_123"
    assert normalize_account_id("act_123") == "act_123"


def test_format_report():
    report = AccountReport(
        account_id="act_1",
        name="Shop <A>",
        currency="VND",
        totals=_insights(500000, messages=20),
        previous_totals=_insights(400000),
        campaigns=[
            CampaignInsights("Camp 1", _insights(300000, messages=12)),
            CampaignInsights("Camp 2", _insights(200000)),
            CampaignInsights("Camp 3", _insights(0)),
        ],
    )
    text = format_report("Báo cáo", date(2026, 9, 30), date(2026, 9, 30), [report], ["act_2: lỗi"], 1)
    assert "Shop &lt;A&gt;" in text
    assert "500.000 ₫" in text and "🔺 25,0%" in text
    assert "Tin nhắn: 20 · Chi phí/kết quả: 25.000 ₫" in text
    assert "1. Camp 1 — 300.000 ₫ · 12 tin nhắn" in text
    assert "… và 1 chiến dịch khác: 200.000 ₫" in text
    assert "act_2: lỗi" in text
    assert "30/09/2026" in text


def test_empty_account():
    report = AccountReport("act_1", "A", "VND", Insights(), [])
    assert "Không có chi tiêu" in format_report("T", date(2026, 1, 1), date(2026, 1, 1), [report], [], 5)


def test_split_message():
    text = "\n".join(["x" * 100] * 100)
    chunks = split_message(text, limit=1000)
    assert all(len(c) <= 1000 for c in chunks)
    assert "\n".join(chunks) == text
