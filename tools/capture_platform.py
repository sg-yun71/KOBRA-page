"""플랫폼 화면(번호·박스 없는 원본) 캡처 → static/images/platform/{explore,relations,terms}.png.

weather_data_platform의 capture_paper_screens.py(논문 그림 6·8 캡처 코드)를 import해 같은 장면을 찍되,
표시(붉은 박스·번호)는 붙이지 않고 1600×1000 화면 그대로 저장한다. 그 레포 파일은 수정하지 않는다.
실행 (플랫폼 서버를 :8010에 먼저 띄울 것 — weather_data_platform 루트에서):
  $env:PYTHONUTF8='1'; & <python> -m uvicorn server:app --app-dir src\\serving\\backend --port 8010
  & "<conda>\\envs\\weather_platform\\python.exe" tools\\capture_platform.py
"""
import sys
from pathlib import Path

PAGE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PAGE.parent / "weather_data_platform" / "src" / "processing" / "validation"))
import capture_paper_screens as cps  # noqa: E402

cps.BASE, cps.W, cps.H, cps.PORT = "http://localhost:8010", 1600, 1000, 9334
OUT = PAGE / "static" / "images" / "platform"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    proc, tab = cps.open_chrome()
    try:
        tab.viewport(cps.W, cps.H, 1)
        cps.extract_scene(tab, prod="g5", vars="TA_1H", t0="2024-07-15 14", t1="2024-07-15 14", gran="3")
        tab.mouse("mouseMoved", cps.W - 10, cps.H - 10)
        tab.shot().save(OUT / "explore.png")
        rel, terms = cps.fig7(tab)            # 변수 관계 · 24절기 (논문 그림 8(a)(b)와 같은 장면)
        rel.save(OUT / "relations.png")
        terms.save(OUT / "terms.png")
    finally:
        proc.kill()


if __name__ == "__main__":
    main()
