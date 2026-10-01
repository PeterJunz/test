"""Client tối giản cho Facebook Marketing API (Insights)."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date

import httpx

ACCOUNT_FIELDS = "account_name,account_currency,spend,impressions,reach,clicks,ctr,cpc,cpm,actions"
CAMPAIGN_FIELDS = "campaign_name,spend,impressions,clicks,ctr,actions"


class FacebookAPIError(RuntimeError):
    pass


@dataclass
class Insights:
    spend: float = 0.0
    impressions: int = 0
    reach: int = 0
    clicks: int = 0
    ctr: float = 0.0
    cpc: float = 0.0
    cpm: float = 0.0
    actions: dict[str, float] = field(default_factory=dict)

    @classmethod
    def from_row(cls, row: dict) -> "Insights":
        return cls(
            spend=float(row.get("spend", 0) or 0),
            impressions=int(row.get("impressions", 0) or 0),
            reach=int(row.get("reach", 0) or 0),
            clicks=int(row.get("clicks", 0) or 0),
            ctr=float(row.get("ctr", 0) or 0),
            cpc=float(row.get("cpc", 0) or 0),
            cpm=float(row.get("cpm", 0) or 0),
            actions={a["action_type"]: float(a.get("value", 0)) for a in row.get("actions", [])},
        )


@dataclass
class CampaignInsights:
    name: str
    insights: Insights


@dataclass
class AccountReport:
    account_id: str
    name: str
    currency: str
    totals: Insights
    campaigns: list[CampaignInsights]
    previous_totals: Insights | None = None


class FacebookAdsClient:
    def __init__(self, access_token: str, api_version: str = "v21.0", timeout: float = 30.0):
        self._token = access_token
        self._base = f"https://graph.facebook.com/{api_version}"
        self._timeout = timeout

    async def _get_all(self, client: httpx.AsyncClient, path: str, params: dict) -> list[dict]:
        """GET có xử lý phân trang (paging.next)."""
        url: str | None = f"{self._base}/{path}"
        query: dict | None = {**params, "access_token": self._token}
        rows: list[dict] = []
        while url:
            resp = await client.get(url, params=query)
            payload = resp.json()
            if resp.status_code != 200 or "error" in payload:
                err = payload.get("error", {})
                raise FacebookAPIError(f"{err.get('message', resp.text)} (code {err.get('code', resp.status_code)})")
            rows.extend(payload.get("data", []))
            url = payload.get("paging", {}).get("next")
            query = None  # URL "next" đã chứa đầy đủ tham số
        return rows

    async def _account_info(self, client: httpx.AsyncClient, account_id: str) -> dict:
        resp = await client.get(
            f"{self._base}/{account_id}",
            params={"fields": "name,currency", "access_token": self._token},
        )
        payload = resp.json()
        if "error" in payload:
            raise FacebookAPIError(f"{account_id}: {payload['error'].get('message')}")
        return payload

    async def _totals(self, client: httpx.AsyncClient, account_id: str, since: date, until: date) -> Insights:
        rows = await self._get_all(
            client,
            f"{account_id}/insights",
            {"fields": ACCOUNT_FIELDS, "level": "account", "time_range": _time_range(since, until)},
        )
        return Insights.from_row(rows[0]) if rows else Insights()

    async def account_report(
        self,
        account_id: str,
        since: date,
        until: date,
        compare_since: date | None = None,
        compare_until: date | None = None,
    ) -> AccountReport:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            info = await self._account_info(client, account_id)
            totals = await self._totals(client, account_id, since, until)
            campaign_rows = await self._get_all(
                client,
                f"{account_id}/insights",
                {
                    "fields": CAMPAIGN_FIELDS,
                    "level": "campaign",
                    "time_range": _time_range(since, until),
                    "sort": '["spend_descending"]',
                    "limit": 100,
                },
            )
            previous = None
            if compare_since and compare_until:
                previous = await self._totals(client, account_id, compare_since, compare_until)

        campaigns = [
            CampaignInsights(name=row.get("campaign_name", "(không tên)"), insights=Insights.from_row(row))
            for row in campaign_rows
        ]
        campaigns.sort(key=lambda c: c.insights.spend, reverse=True)
        return AccountReport(
            account_id=account_id,
            name=info.get("name", account_id),
            currency=info.get("currency", "USD"),
            totals=totals,
            campaigns=campaigns,
            previous_totals=previous,
        )


def _time_range(since: date, until: date) -> str:
    return json.dumps({"since": since.isoformat(), "until": until.isoformat()})
