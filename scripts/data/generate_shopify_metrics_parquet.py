#!/usr/bin/env python3
from __future__ import annotations

import math
import random
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import pandas as pd


@dataclass(frozen=True)
class AgencySeed:
    name: str
    stores: list[str]


AGENCIES = [
    AgencySeed(name="Aurora Agency", stores=[
        "Aurora Bikes",
        "Aurora Coffee",
        "Aurora Fitness",
        "Aurora Pets",
        "Aurora Apparel",
    ]),
    AgencySeed(name="Beacon Agency", stores=[
        "Beacon Home",
        "Beacon Outdoor",
        "Beacon Grooming",
        "Beacon Snacks",
        "Beacon Supplements",
    ]),
    AgencySeed(name="Catalyst Agency", stores=[
        "Catalyst Beauty",
        "Catalyst Tech",
        "Catalyst Wellness",
        "Catalyst Kids",
        "Catalyst Studio",
    ]),
]


def build_rows() -> list[dict[str, object]]:
    rng = random.Random(4242)
    start = date(2024, 1, 1)
    days = 730
    rows: list[dict[str, object]] = []

    for agency_index, agency in enumerate(AGENCIES):
        for store_index, store_name in enumerate(agency.stores):
            baseline = 1200 + agency_index * 250 + store_index * 160
            margin = 0.32 + (store_index * 0.01)
            spend_ratio = 0.17 + (agency_index * 0.01)

            for day_offset in range(days):
                current_day = start + timedelta(days=day_offset)
                seasonal = 1 + 0.12 * math.sin((2 * math.pi * day_offset) / 30.0)
                random_noise = 0.9 + (rng.random() * 0.25)
                net_sales = max(0.0, baseline * seasonal * random_noise)
                gross_profit = net_sales * margin
                ad_spend = max(1.0, net_sales * spend_ratio * (0.8 + rng.random() * 0.4))
                mer = net_sales / ad_spend

                rows.append(
                    {
                        "agency_name": agency.name,
                        "store_name": store_name,
                        "metric_date": current_day.isoformat(),
                        "source": "shopify",
                        "net_sales": round(net_sales, 2),
                        "gross_profit": round(gross_profit, 2),
                        "marketing_ad_spend": round(ad_spend, 2),
                        "mer": round(mer, 4),
                    }
                )
    return rows


def main() -> None:
    output = Path("data/fixtures/shopify_metrics_daily.parquet")
    output.parent.mkdir(parents=True, exist_ok=True)

    rows = build_rows()
    df = pd.DataFrame(rows)
    df.to_parquet(output, index=False, engine="pyarrow", version="1.0")
    print(f"Wrote {len(rows)} rows to {output}")


if __name__ == "__main__":
    main()
