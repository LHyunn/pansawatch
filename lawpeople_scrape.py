"""
lawpeople.lawtimes.co.kr 검색 결과에서 사람들의 프로필 링크를 추출.

페이지가 Next.js 로 SSR 되어 있고, `__NEXT_DATA__` 또는
`/_next/data/<buildId>/search.json?...` 엔드포인트가 검색 결과 JSON 을
그대로 돌려줌. 그래서 HTML 파싱 없이 JSON 으로 바로 받아 처리한다.

프로필 URL 패턴: https://lawpeople.lawtimes.co.kr/lawman/{serial}
"""
from __future__ import annotations

import json
import re
import sys
from typing import Iterator
from urllib.parse import urlencode

import requests

BASE = "https://lawpeople.lawtimes.co.kr"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)


def get_build_id(session: requests.Session) -> str:
    """홈페이지의 __NEXT_DATA__ 에서 현재 buildId 추출. 재배포되면 바뀐다."""
    r = session.get(f"{BASE}/", timeout=15)
    r.raise_for_status()
    m = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        r.text,
        re.DOTALL,
    )
    if not m:
        raise RuntimeError("__NEXT_DATA__ 스크립트를 찾을 수 없음")
    return json.loads(m.group(1))["buildId"]


def fetch_page(
    session: requests.Session, build_id: str, sort: str, page: int, name: str = ""
) -> dict:
    qs = urlencode({"sort": sort, "name": name, "page": page})
    url = f"{BASE}/_next/data/{build_id}/search.json?{qs}"
    r = session.get(url, timeout=15)
    r.raise_for_status()
    return r.json()["pageProps"]["initialState"]["searchFilter"]["apiData"]


def iter_results(
    sort: str = "판사,대법관", name: str = "", max_pages: int | None = None
) -> Iterator[dict]:
    """검색 결과를 페이지 끝까지(또는 max_pages 까지) 순회하며 yield."""
    session = requests.Session()
    session.headers.update({"User-Agent": UA, "Accept": "application/json"})
    build_id = get_build_id(session)

    page = 1
    while True:
        data = fetch_page(session, build_id, sort, page, name)
        for item in data["items"]:
            serial = str(item["serial"]).strip()
            yield {
                "serial": serial,
                "name": (item.get("name") or "").strip(),
                "jobname": (item.get("jobname") or "").strip(),
                "url": f"{BASE}/lawman/{serial}",
            }
        if not data.get("has_next"):
            break
        if max_pages is not None and page >= max_pages:
            break
        page += 1


if __name__ == "__main__":
    # 첫 페이지만 보고 싶으면 max_pages=1, 전체면 None
    rows = list(iter_results(sort="판사,대법관", max_pages=1))
    print(f"{len(rows)}건")
    for r in rows:
        print(f"{r['name']:<10} {r['jobname'][:30]:<32} {r['url']}")
