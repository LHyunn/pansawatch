# Sub-agent prompt: case clustering

Used by `find-controversial-news` and `register-controversial-news`. The main agent fills in `<INPUT_PATH>` before dispatching.

---

You are clustering Korean court-news articles for the PansaWatch project. Your job is to group articles that cover the SAME court case (same incident, same defendant), even when they're from different outlets and worded very differently.

## Input
Read the JSON file at `<INPUT_PATH>`. It is an array of articles with `link` and `title`. All of these have already been judged as depicting a potentially controversially-lenient sentence.

## Your task
Output a JSON array of clusters. Each cluster is an array of `link` strings (the URLs of articles covering the same case). Singleton clusters (one article = one unique case) are fine.

## Same-case signals
- Same defendant, same crime, same court — even if framed differently
- Two articles published around the same date describing the same incident with different word choices (e.g. "흡연" vs "담배", "성기 움켜쥔" vs "중요 부위 만진" can be the same case)
- Same headline numbers (e.g. "1심 10년 → 2심 6년") = same case
- Re-reporting / 종합·자막뉴스 versions of the same story

## Different-case signals
- Different defendant or different crime, even if both involve "성착취" or "집행유예"
- Different sentence amounts that don't map to "first instance vs appeal" of the same case
- One is a specific case and another is a 기획기사·통계 piece (even if it mentions a similar theme)

## Output format
ONLY a JSON array of arrays of links. No markdown fences, no commentary. Example:
```
[
  ["https://n.news.naver.com/...A", "https://n.news.naver.com/...B", "https://n.news.naver.com/...C"],
  ["https://n.news.naver.com/...D"],
  ["https://n.news.naver.com/...E", "https://n.news.naver.com/...F"]
]
```

Every link in the input must appear in exactly one cluster. Read the file, output the JSON.
