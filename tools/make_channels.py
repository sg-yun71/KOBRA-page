"""catalog.yaml → static/demo/channels.json (Dataset 절 '변수 구성' 목록).

채널 묶음은 catalog.yaml의 구획(병합 / ASOS / AWS / SEA / PM10 / UPP)을 코드 접두어로 그대로 따른다.
group: static(정적 5채널)은 논문의 104채널에 들지 않으므로 뺀다 — 논문: 지상·해양 73 + 고층 31 = 104.
실행: & "<conda>\\envs\\weather_platform\\python.exe" tools\\make_channels.py
"""
import json
from pathlib import Path

import yaml

PAGE = Path(__file__).resolve().parents[1]
CATALOG = PAGE.parent / "weather_data_platform" / "src" / "catalog" / "catalog.yaml"
PAPER = {"monthly": 73, "upp": 31}   # 논문 3.2절 채널 수

# (접두어, 묶음 이름, 설명) — 설명은 catalog.yaml 구획 주석과 논문 3.2절 근거
SURFACE = [
    ("", "여러 관측망 통합", "같은 물리량은 종관·방재(·해양) 관측점을 합쳐 보간한 채널"),
    ("ASOS_", "종관기상관측", "종관기상관측에만 있는 변수"),
    ("AWS_", "방재기상관측", "방재기상관측의 1시간 내 통계(평균·최고·최저 등)"),
    ("SEA_", "해양", "해양 관측에만 있는 변수 — 바다 격자에만 값이 있다"),
    ("PM10_", "황사관측", "보간하지 않고 관측소가 위치한 격자에만 관측값을 할당"),
]
LEVELS = ["925", "850", "700", "500", "300"]


def surface_group(code: str) -> int:
    hits = [i for i, (p, _, _) in enumerate(SURFACE) if p and code.startswith(p)]
    return hits[0] if hits else 0


def upp_group(code: str) -> str:
    _, var, lv = (code.split("_") + [""])[:3]   # UPP_TA_850 — UPP_DT850_500 같은 지수는 기타
    return lv if var in {"TA", "TD", "U", "V", "GH"} and lv in LEVELS else "etc"


def row(code: str, c: dict) -> list:
    return [code, c["name_ko"], str(c["unit"])]


def main() -> None:
    ch = yaml.safe_load(CATALOG.read_text(encoding="utf-8"))["channels"]
    mon = {k: v for k, v in ch.items() if v["group"] == "monthly"}
    upp = {k: v for k, v in ch.items() if v["group"] == "upp"}
    for g, n in PAPER.items():
        got = len(mon if g == "monthly" else upp)
        assert got == n, f"{g}: catalog {got}채널 ≠ 논문 {n}채널"

    sg = [{"label": l, "note": t, "channels": []} for _, l, t in SURFACE]
    for k, v in mon.items():
        sg[surface_group(k)]["channels"].append(row(k, v))
    ug = {lv: {"label": f"{lv} hPa", "note": "기압면별 1차 평면 보간", "channels": []} for lv in LEVELS}
    ug["etc"] = {"label": "지수 · 기타", "note": "한 기압면에 속하지 않는 채널", "channels": []}
    for k, v in upp.items():
        ug[upp_group(k)]["channels"].append(row(k, v))

    out = {"blocks": [
        {"label": "지상·해양 관측", "count": len(mon), "groups": sg},
        {"label": "고층 관측", "count": len(upp), "groups": list(ug.values())},
    ]}
    dst = PAGE / "static" / "demo" / "channels.json"
    dst.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for b in out["blocks"]:
        print(b["label"], b["count"], [(g["label"], len(g["channels"])) for g in b["groups"]])
    print("static(제외):", [k for k, v in ch.items() if v["group"] == "static"])


if __name__ == "__main__":
    main()
