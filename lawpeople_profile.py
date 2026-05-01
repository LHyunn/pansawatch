"""
lawpeople.lawtimes.co.kr 법조인 프로필 추출기.
사용 예: python lawpeople_profile.py 10915
"""
import json
import re
import sys
from typing import Any

import requests

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
    re.S,
)


def _clean(v: Any) -> Any:
    """문자열 양끝 공백 제거 (DB 패딩 흔적 정리)."""
    return v.strip() if isinstance(v, str) else v


def fetch_lawman_profile(serial: int | str, timeout: int = 10) -> dict:
    """
    /lawman/{serial}/preview 페이지에서 법조인 프로필을 추출한다.
    페이지가 Next.js SSR이라 초기 JSON(__NEXT_DATA__)에 데이터가 박혀있어
    별도 API 호출이나 헤드리스 브라우저 없이 바로 파싱 가능하다.
    """
    url = f"https://lawpeople.lawtimes.co.kr/lawman/{serial}/preview"
    res = requests.get(url, headers={"User-Agent": UA}, timeout=timeout)
    res.raise_for_status()
    res.encoding = "utf-8"

    m = NEXT_DATA_RE.search(res.text)
    if not m:
        raise RuntimeError("__NEXT_DATA__ 스크립트를 찾지 못했습니다.")

    payload = json.loads(m.group(1))
    preview = (
        payload.get("props", {})
        .get("pageProps", {})
        .get("initialState", {})
        .get("lawmanDetail", {})
        .get("previewData")
    )
    if not preview:
        raise RuntimeError(f"serial={serial} 에 해당하는 프로필 데이터가 없습니다.")

    cleaned = {k: _clean(v) for k, v in preview.items()}

    return {
        "serial": cleaned.get("serial"),
        "name": cleaned.get("name"),
        "name_hanja": cleaned.get("h_name"),
        "birth": cleaned.get("birth"),
        "job_title": cleaned.get("sort"),
        "job_org": cleaned.get("jobname"),
        "part": cleaned.get("partname"),
        "address": cleaned.get("addr"),
        "exam_type": cleaned.get("examtype"),
        "exam_no": cleaned.get("examsort"),
        "exam_class": cleaned.get("examsortth"),
        "image_url": cleaned.get("image_url"),
        "school_count": cleaned.get("schoolLength"),
        "career_count": cleaned.get("careerLength"),
        "prize_count": cleaned.get("prizeLength"),
        "books_count": cleaned.get("booksLength"),
        "paper_count": cleaned.get("paperLength"),
        "related_news": cleaned.get("relative_news_nums"),
        "_raw": cleaned,
    }


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "10915"
    serial = re.search(r"\d+", arg).group()
    profile = fetch_lawman_profile(serial)
    print(json.dumps(profile, ensure_ascii=False, indent=2))
