"""결과 차트 4종의 숫자 → static/demo/charts.json. 값은 실험 결과 파일에서만 읽는다.

  fig10 : b_holdout_sweep/results.csv — 제외 비율 1~30 %별 RMSE, 반복 10회의 평균·최소·최대 (holdout_sweep.plot v3와 같은 집계)
  fig12 : k_elev_profile/rmse_elev.csv — 해발고도 구간별 KOBRA·ERA5 기온 RMSE와 95 % CI (fig12_rmse.py 출력)
  table5: g_station_eval/tables.csv — 예측 시간별 관측소 RMSE (B = U-Net, persist_obs, clim)
  fig11b: 그림 11(b) 홍천–강릉 단면 — compare_fields.export_fig8_layers와 같은 표본(위도 37.7°, 501점)을
          NAS의 static_500m·ERA5·500 m 스토어(2023-01-25 15시 KST)와 지상 관측에서 다시 뽑는다 (읽기만)
실행: & "<conda>\\envs\\weather_platform\\python.exe" tools\\make_chart_data.py
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

PAGE = Path(__file__).resolve().parents[1]
EXP = PAGE.parent / "weather_data_platform" / "experiments" / "revision_20261002"
VALID = PAGE.parent / "weather_data_platform" / "src" / "processing" / "validation"
SHORT = {"홍천": "홍천", "서석": "서석", "평창용산": "평창", "대관령": "대관령", "강릉성산": "성산"}   # 그림 11(b)·표 3 지명


def fig10() -> dict:
    r = pd.read_csv(EXP / "b_holdout_sweep" / "results.csv").query("p <= 30")   # 논문 그림은 1~30 %
    out = {"p": sorted(r.p.unique().tolist())}
    for (var, m), g in r.groupby(["var", "method"]):
        s = g.groupby("p").rmse
        out.setdefault(var, {})[m] = {k: s.agg(k).round(4).tolist() for k in ("mean", "min", "max")}
    return out


def fig12() -> dict:
    b = pd.read_csv(EXP / "k_elev_profile" / "rmse_elev.csv")
    cols = ["bin", "n_stn", "elev_mean", "bld", "bld_lo", "bld_hi", "era5", "era5_lo", "era5_hi"]
    return {c: b[c].round(4).tolist() if b[c].dtype.kind == "f" else b[c].tolist() for c in cols}


def table5() -> dict:
    t = pd.read_csv(EXP / "g_station_eval" / "tables.csv").query("model in ['B', 'persist_obs', 'clim']")
    return {var: {m: g.sort_values("lead").rmse.round(4).tolist() for m, g in tv.groupby("model")}
            for var, tv in t.groupby("var")}


def fig11b() -> dict:
    sys.path.insert(0, str(VALID))
    import xarray as xr
    from compare_fields import (DATA, SECTION, Field, load_era5, load_ours, sample_nearest, section_obs,
                                section_stations)
    date, lat = "20230125", SECTION[0]
    stns = section_stations()
    hong, gang = stns[0][1], stns[-1][1]
    km = 111.32 * np.cos(np.radians(lat))
    lon = np.linspace(hong, gang, 501)
    st = xr.load_dataset(DATA / "reference" / "static_500m.nc")
    elev = sample_nearest(Field(st.lon.values, st.lat.values, st.elev.values), lon, lat)
    era5 = sample_nearest(load_era5(date)["temp"], lon, lat)
    kobra = sample_nearest(load_ours(date, "500m")["temp"], lon, lat)
    obs = section_obs(date, lat, hong - 0.01, gang)
    return {"x": ((lon - hong) * km).round(2).tolist(), "elev": elev.astype(float).round(0).tolist(),
            "era5": era5.astype(float).round(2).tolist(), "kobra": kobra.astype(float).round(2).tolist(),
            "obs": [{"name": SHORT[r.STN_KO], "x": round((r.LON - hong) * km, 2), "t": float(r.TA)} for r in obs.itertuples()]}


if __name__ == "__main__":
    data = {"fig10": fig10(), "fig12": fig12(), "table5": table5(), "fig11b": fig11b()}
    (PAGE / "static" / "demo" / "charts.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print("fig10 TA builder mean p=20:", data["fig10"]["TA_1H"]["builder"]["mean"][19])
    print("fig12 ≥900:", data["fig12"]["bld"][-1], data["fig12"]["era5"][-1])
    print("table5 TA 6h:", {m: v[-1] for m, v in data["table5"]["TA"].items()})
    d = data["fig11b"]
    print("fig11b obs:", [(o["name"], o["t"], d["era5"][int(np.argmin(np.abs(np.array(d["x"]) - o["x"])))],
                           d["kobra"][int(np.argmin(np.abs(np.array(d["x"]) - o["x"])))]) for o in d["obs"]])
