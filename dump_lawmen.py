"""
검색결과 → 상세 프로필 → CSV 저장 오케스트레이터.

판사·대법관 전체(약 3,262명)를 순회하므로 시간이 걸린다.
중단되더라도 같은 출력 경로로 재실행하면 이미 저장된 serial 은 건너뛴다.
요청 사이에 sleep_sec 만큼 쉬므로(기본 0.3초) 서버 예의 차원의 페이싱도 한다.

사용:
    python dump_lawmen.py                          # 판사,대법관 전체 → lawmen_judges.csv
    python dump_lawmen.py out.csv                  # 출력 경로 변경
    python dump_lawmen.py out.csv 검사             # 검사로 필터
    python dump_lawmen.py out.csv 판사,대법관 50   # 처음 50명만 (테스트용)
    python dump_lawmen.py out.csv 판사,대법관 0 10 # 전체 + 10초 페이싱
                                                   #   (max_records=0 또는 all 이면 전체)
"""
from __future__ import annotations

import csv
import sys
import time
from pathlib import Path

import requests

from lawpeople_profile import fetch_lawman_profile
from lawpeople_scrape import iter_results

# fetch_lawman_profile 가 돌려주는 키 중 CSV 에 쓸 컬럼 (_raw 제외)
COLUMNS = [
    "serial",
    "name",
    "name_hanja",
    "birth",
    "job_title",
    "job_org",
    "part",
    "address",
    "exam_type",
    "exam_no",
    "exam_class",
    "image_url",
    "school_count",
    "career_count",
    "prize_count",
    "books_count",
    "paper_count",
    "related_news",
    "search_url",
]


def already_done(csv_path: Path) -> set[str]:
    """기존 CSV에서 이미 수집된 serial 집합을 읽어온다 (resume 용)."""
    if not csv_path.exists():
        return set()
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        return {row["serial"] for row in csv.DictReader(f) if row.get("serial")}


def dump_to_csv(
    out_path: Path,
    sort: str = "판사,대법관",
    sleep_sec: float = 0.3,
    max_records: int | None = None,
    progress_every: int = 25,
) -> None:
    done = already_done(out_path)
    is_new = not out_path.exists()
    print(f"출력: {out_path}  (기존 수집 {len(done)}건)")
    print(f"필터: sort={sort!r}  pacing={sleep_sec}s  limit={max_records}")

    # 줄 단위 버퍼링 + 매 행 flush → 도중에 죽어도 여태까지 저장된 행은 안전
    f = out_path.open("a", encoding="utf-8-sig", newline="", buffering=1)
    ok = fail = skipped = 0
    try:
        writer = csv.DictWriter(f, fieldnames=COLUMNS, extrasaction="ignore")
        if is_new:
            writer.writeheader()

        for i, person in enumerate(iter_results(sort=sort), start=1):
            if max_records is not None and ok >= max_records:
                break

            serial = str(person["serial"])
            if serial in done:
                skipped += 1
                continue

            try:
                profile = fetch_lawman_profile(serial)
            except requests.HTTPError as e:
                fail += 1
                code = e.response.status_code if e.response is not None else "?"
                print(f"  [{i}] serial={serial} {person['name']!r} HTTP {code}")
                continue
            except Exception as e:  # noqa: BLE001 - 한 명 실패해도 나머지는 계속
                fail += 1
                print(f"  [{i}] serial={serial} {person['name']!r} ERR {e!r}")
                continue

            row = {k: profile.get(k) for k in COLUMNS}
            row["search_url"] = person["url"]
            writer.writerow(row)
            f.flush()
            done.add(serial)
            ok += 1

            if ok % progress_every == 0:
                print(f"  진행 {ok}건  (실패 {fail}, 스킵 {skipped})")

            time.sleep(sleep_sec)
    finally:
        f.close()

    print(f"완료: 신규 {ok}건, 실패 {fail}건, 스킵 {skipped}건 → {out_path}")


def main(argv: list[str]) -> None:
    out_path = Path(argv[1]) if len(argv) > 1 else Path("lawmen_judges.csv")
    sort = argv[2] if len(argv) > 2 else "판사,대법관"
    max_records: int | None
    if len(argv) > 3 and argv[3] not in ("", "0", "all"):
        max_records = int(argv[3])
    else:
        max_records = None
    sleep_sec = float(argv[4]) if len(argv) > 4 else 0.3
    dump_to_csv(
        out_path=out_path,
        sort=sort,
        max_records=max_records,
        sleep_sec=sleep_sec,
    )


if __name__ == "__main__":
    main(sys.argv)
