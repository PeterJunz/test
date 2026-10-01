import asyncio
import json
from datetime import date

import httpx

from fb_ads_bot import facebook
from fb_ads_bot.facebook import FacebookAdsClient


def test_account_report_with_paging(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        params = request.url.params
        if request.url.path.endswith("/act_1"):
            return httpx.Response(200, json={"name": "Shop", "currency": "VND"})
        if params.get("level") == "account":
            spend = "100000" if json.loads(params["time_range"])["since"] == "2026-09-30" else "80000"
            return httpx.Response(200, json={"data": [{"spend": spend, "impressions": "1000"}]})
        if params.get("page") == "2":
            return httpx.Response(200, json={"data": [{"campaign_name": "B", "spend": "70000"}]})
        return httpx.Response(200, json={
            "data": [{"campaign_name": "A", "spend": "30000"}],
            "paging": {"next": "https://graph.facebook.com/v21.0/act_1/insights?page=2"},
        })

    real_client = httpx.AsyncClient
    monkeypatch.setattr(facebook.httpx, "AsyncClient",
                        lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw))

    client = FacebookAdsClient("token")
    day, prev = date(2026, 9, 30), date(2026, 9, 29)
    report = asyncio.run(client.account_report("act_1", day, day, prev, prev))

    assert report.name == "Shop" and report.currency == "VND"
    assert report.totals.spend == 100000
    assert report.previous_totals.spend == 80000
    assert [c.name for c in report.campaigns] == ["B", "A"]
