"""인터랙티브 데모 3종의 정적 데이터 생성 — static/demo/{try,swipe,nowcast}/.

원천은 형제 레포 weather_data_platform(읽기 전용, data\\ = NAS 링크). 그 레포의 그림 코드
(compare_fields.paper_row · plot_paper_fig7.draw_map)를 import해 논문 그림과 같은 지도 규칙으로 그린다.
  try     : 5 km monthly.zarr·upp.zarr 2024-07-15 00~23 KST, TA·HM·WS·RN·PA + 850 hPa 기온·풍속(그림 4의 6변수 포함)
            → uint8 양자화 .bin + meta.json + 해안선 PNG
  swipe   : 그림 11(a)와 같은 사례·영역·색 범위(compare_fields.export_fig8_layers 규칙) — ERA5 / KOBRA 500 m 축 없는 PNG
  nowcast : 그림 13 사례(2025-09-11 09 KST) +1~+6 h 기온 — 정답(forecast_cache/2025.npy) · U-Net(pred_2025_B_h6.npy)
  stations: 그림 2와 같은 2024년 관측소(plot_paper_domain 선정 규칙, 지상은 ASOS·AWS로 나눔) → stations.json, Natural Earth 육지 → land.json
실행 (cartopy가 있는 weather_exp 환경):
  $env:PYTHONUTF8='1'; $env:PATH = "<conda>\\envs\\weather_exp\\Library\\bin;" + $env:PATH
  & "<conda>\\envs\\weather_exp\\python.exe" tools\\make_demo_data.py [try|swipe|nowcast|stations ...]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
import xarray as xr  # noqa: E402
from matplotlib.colors import BoundaryNorm, ListedColormap, Normalize, to_hex  # noqa: E402

PAGE = Path(__file__).resolve().parents[1]
OUT = PAGE / "static" / "demo"
WDP = PAGE.parent / "weather_data_platform"
DATA = WDP / "data"
# 그림 코드 import 시 시도 경계 캐시가 없으면 data\ 아래에 새로 쓴다 — 읽기 전용 원칙이라 있을 때만 진행
assert (DATA / "work" / "compare_fields" / "sido_borders_5179.wkb").exists()
sys.path.insert(0, str(WDP / "src" / "processing" / "validation"))
sys.path.insert(0, str(WDP / "experiments" / "forecast"))


def hexes(cmap, n: int) -> list[str]:
    return [to_hex(c) for c in cmap(np.linspace(0, 1, n))]


def ticks(lo: float, hi: float) -> list:
    """범례 눈금 [위치 비율, 글자] — 색 범위 안의 보기 좋은 값."""
    t = matplotlib.ticker.MaxNLocator(nbins=7, steps=[1, 2, 2.5, 5, 10]).tick_values(lo, hi)
    return [[(v - lo) / (hi - lo), f"{v:g}"] for v in t if lo <= v <= hi]


def strip_axes(ax) -> None:
    """map_layer(export_fig8_layers)와 같다 — 1° 점선 격자·눈금·틀 제거, 이미지 = 지도 영역."""
    for ln in list(ax.lines):
        ln.remove()
    ax.set_xticks([])
    ax.set_yticks([])
    ax.set_xlabel("")
    ax.set_ylabel("")
    ax.spines["geo"].set_visible(False)


def save_map(fig, path: Path, dpi: int) -> None:
    fig.savefig(path, dpi=dpi, facecolor="white")
    plt.close(fig)


# ── 1. Try KOBRA ────────────────────────────────────────────────────
TRY_DAY = "2024-07-15"
TRY_VARS = {  # 채널: (버튼 이름, 한글 이름, 단위, 색표, 양자화 변환) — 추가 3개의 색표는 그림 4(plot_paper_dataset.PANELS)와 같다
    "TA_1H": ("Temperature", "기온", "°C", "coolwarm", "linear"),
    "HM_1H": ("Humidity", "상대습도", "%", "YlGnBu", "linear"),
    "WS_1H": ("Wind speed", "풍속", "m/s", "viridis", "linear"),
    "RN_1H": ("Precipitation", "1시간 강수", "mm", "rain", "sqrt"),
    "PA_1H": ("Pressure", "현지기압", "hPa", "PuBu", "linear"),
    "UPP_TA_850": ("850 hPa temp.", "850 hPa 기온", "°C", "OrRd", "linear"),
    "WS_850": ("850 hPa wind", "850 hPa 풍속", "m/s", "Purples", "linear"),   # |UPP_U_850, UPP_V_850| (그림 4와 같은 계산)
}
RAIN_BOUNDS = [0.1, 0.5, 1, 2, 3, 5, 8, 12]  # 논문 강수 단계(compare_fields.RAIN_BOUNDS) — 0.1 미만 투명


def quantize(a: np.ndarray, tf: str) -> tuple[np.ndarray, float, float]:
    """NaN → 255, 나머지 0..254. 값 = (code*scale + offset), sqrt면 그 제곱."""
    v = np.sqrt(np.clip(a, 0, None)) if tf == "sqrt" else a
    lo, hi = float(np.nanmin(v)), float(np.nanmax(v))
    scale = (hi - lo) / 254 or 1.0
    code = np.where(np.isfinite(v), np.rint((v - lo) / scale), 255).astype(np.uint8)
    return code, scale, lo


def lut_and_legend(a: np.ndarray, cmap_name: str, scale: float, offset: float, tf: str) -> tuple[list, dict]:
    """code(0..254) → 색(hex, 투명은 "") 와 범례(그라디언트 색·눈금). 색 범위는 하루 전체 1–99 백분위로 고정."""
    vals = offset + scale * np.arange(255)
    if tf == "sqrt":
        vals = vals ** 2
    if cmap_name == "rain":
        cmap = ListedColormap(plt.get_cmap("Blues")(np.linspace(0.15, 1, len(RAIN_BOUNDS))))
        norm = BoundaryNorm(RAIN_BOUNDS, cmap.N, extend="max")
        lut = ["" if v < RAIN_BOUNDS[0] else to_hex(cmap(norm(v))) for v in vals]
        steps = [to_hex(c) for c in cmap(np.arange(cmap.N))]
        legend = {"steps": steps, "ticks": [[i / len(steps), f"{b:g}"] for i, b in enumerate(RAIN_BOUNDS)]}
        return lut, legend
    lo, hi = (float(x) for x in np.nanpercentile(a, [1, 99]))
    cmap, norm = plt.get_cmap(cmap_name), Normalize(lo, hi)
    lut = [to_hex(cmap(norm(v))) for v in vals]
    legend = {"gradient": hexes(cmap, 32), "vmin": lo, "vmax": hi, "ticks": ticks(lo, hi)}
    return lut, legend


def coast_png(st: xr.Dataset, path: Path, k: int = 4) -> None:
    """Natural Earth 10m 해안선을 EPSG:5179로 투영해 격자 픽셀 좌표(칸 가장자리 기준)에 투명 PNG로."""
    import cartopy.feature as cfeature
    from pyproj import Transformer
    x, y = st.x.values, st.y.values
    dx = float(x[1] - x[0])
    x0, y0, W, H = x[0] - dx / 2, y[0] + dx / 2, len(x), len(y)
    tr = Transformer.from_crs(4326, 5179, always_xy=True)
    fig = plt.figure(figsize=(W * k / 100, H * k / 100), dpi=100)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, W)
    ax.set_ylim(H, 0)
    ax.axis("off")
    lon, lat = st.lon.values, st.lat.values
    box = [lon.min() - 1, lon.max() + 1, lat.min() - 1, lat.max() + 1]
    for g in cfeature.COASTLINE.with_scale("10m").intersecting_geometries(box):
        for line in getattr(g, "geoms", [g]):
            X, Y = tr.transform(*np.asarray(line.coords).T)
            ax.plot((X - x0) / dx, (y0 - Y) / dx, color="#4a5566", linewidth=0.6, solid_capstyle="round")
    fig.savefig(path, dpi=100, transparent=True)
    plt.close(fig)


def make_try() -> None:
    out = OUT / "try"
    out.mkdir(parents=True, exist_ok=True)
    st = xr.load_dataset(DATA / "reference" / "static.nc")
    times = pd.date_range(f"{TRY_DAY} 00:00", periods=24, freq="h")
    g5 = DATA / "3_grid_5km"
    ds = xr.open_zarr(g5 / "monthly.zarr")[["TA_1H", "HM_1H", "WS_1H", "RN_1H", "PA_1H"]].sel(time=times).load()
    upp = xr.open_zarr(g5 / "upp.zarr")[["UPP_TA_850", "UPP_U_850", "UPP_V_850"]].sel(time=times).load()
    arr = {k: ds[k].values for k in ds} | {"UPP_TA_850": upp.UPP_TA_850.values,
                                           "WS_850": np.hypot(upp.UPP_U_850.values, upp.UPP_V_850.values)}
    H, W = st.sizes["y"], st.sizes["x"]
    meta = {"date": TRY_DAY, "timezone": "KST", "times": [f"{t:%H}:00" for t in times], "H": H, "W": W,
            "nodata": 255, "source": "KOBRA 5 km (monthly.zarr, upp.zarr)", "vars": {}}
    for ch, (name, name_ko, unit, cmap, tf) in TRY_VARS.items():
        a = arr[ch].astype(np.float32)
        code, scale, offset = quantize(a, tf)
        code.tofile(out / f"{ch}.bin")
        lut, legend = lut_and_legend(a, cmap, scale, offset, tf)
        dec = offset + scale * code.astype(np.float32)
        dec = dec ** 2 if tf == "sqrt" else dec
        err = np.nanmax(np.abs(np.where(code < 255, dec, np.nan) - a))
        meta["vars"][ch] = {"name": name, "name_ko": name_ko, "unit": unit, "file": f"{ch}.bin", "scale": scale, "offset": offset,
                            "transform": tf, "lut": lut, "legend": legend}
        print(f"{ch}: range {np.nanmin(a):.2f}..{np.nanmax(a):.2f} {unit}, NaN {np.isnan(a).mean() * 100:.1f}%, "
              f"max quantization error {err:.3f}")
    np.concatenate([st.lon.values.ravel(), st.lat.values.ravel()]).astype(np.float32).tofile(out / "lonlat.bin")
    coast_png(st, out / "coast.png")
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")


# ── 2. ERA5 vs KOBRA swipe (그림 11a) ───────────────────────────────
def make_swipe() -> None:
    import cartopy.crs as ccrs
    from compare_fields import HOUR_KST, ZOOM, Field, load_era5, paper_row
    from plot_paper_domain import MAP_EXTENT
    out, date, dpi = OUT / "swipe", "20230125", 400
    out.mkdir(parents=True, exist_ok=True)
    st = xr.load_dataset(DATA / "reference" / "static_500m.nc")
    kst = pd.Timestamp(f"{date} {HOUR_KST:02d}:00")
    ta = xr.open_zarr(DATA / "3_grid_500m" / f"grid_500m_full_{date[:4]}.zarr")["TA_1H"].sel(time=kst).values
    fields = {"era5": load_era5(date)["temp"], "kobra": Field(st.lon.values, st.lat.values, ta.astype("float32"))}
    zw, ze, zs, zn = ZOOM                                       # 색 범위·치수 = export_fig8_layers 그대로
    vrange = tuple(float(v) for v in np.nanpercentile(np.concatenate(
        [f.val[(f.lon >= zw) & (f.lon <= ze) & (f.lat >= zs) & (f.lat <= zn)] for f in fields.values()]), [1, 99]))
    W, left, link, gap, cb_pad, cb_w, cb_lab, right = 7.0, 0.05, 0.35, 0.1, 0.06, 0.06, 0.4, 0.05
    pz = (W - left - link - gap - cb_pad - cb_w - cb_lab - right) / 2.7
    hz = pz * (zn - zs) / (ze - zw) / np.cos(np.radians(np.mean(MAP_EXTENT[2:])))
    for name, f in fields.items():
        fig = plt.figure(figsize=(pz, hz), dpi=dpi)
        ax = fig.add_axes([0, 0, 1, 1], projection=ccrs.PlateCarree())
        paper_row([ax], None, {name: f}, "temp", box=ZOOM, vrange=vrange)
        strip_axes(ax)
        save_map(fig, out / f"{name}.png", dpi)
    meta = {"time_kst": f"{kst:%Y-%m-%d %H:%M}", "extent_wesn": ZOOM, "unit": "°C", "vmin": vrange[0],
            "vmax": vrange[1], "gradient": hexes(plt.get_cmap("coolwarm"), 32),
            "ticks": ticks(*vrange)}
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    print("swipe vrange", vrange)


# ── 3. Nowcast player (그림 13) ─────────────────────────────────────
CASE = pd.Timestamp("2025-09-11 09:00")
LEADS = range(1, 7)


def make_nowcast() -> None:
    import cartopy.crs as ccrs
    from compare_fields import Field, paper_range
    from plot_paper_dataset import DATA_BOX
    from plot_paper_domain import MAP_EXTENT
    from plot_paper_fig7 import draw_map
    out, fc, dpi = OUT / "nowcast", WDP / "experiments" / "forecast", 200
    out.mkdir(parents=True, exist_ok=True)
    st = xr.load_dataset(DATA / "reference" / "static.nc")
    kc = int(np.flatnonzero(pd.DatetimeIndex(np.load(fc / "pred_2025_times_h6.npy")) == CASE)[0])
    pred = np.load(fc / "pred_2025_B_h6.npy", mmap_mode="r")          # (730, 리드×(TA,WS,RN), H, W) fp16
    truth = np.load(DATA / "work" / "forecast_cache" / "2025.npy", mmap_mode="r")   # (8760, 13, H, W), TA_1H = 0
    t0 = int((CASE - pd.Timestamp("2025-01-01")) / pd.Timedelta(hours=1))
    frames = {}
    for L in LEADS:
        frames[f"truth_{L}"] = truth[t0 + L, 0].astype(np.float32)
        frames[f"pred_{L}"] = pred[kc, (L - 1) * 3].astype(np.float32)
    ref = np.load(WDP / "experiments" / "revision_20261002" / "c_task_application" / "case_20250911_09.npz")
    for L in (1, 3, 6):                                                # score.py 저장본과 같은 배열인지 확인
        assert np.allclose(ref[f"truth_{L}"], frames[f"truth_{L}"], equal_nan=True)
        assert np.allclose(ref[f"B_{L}"], frames[f"pred_{L}"], equal_nan=True)
    F = {k: Field(st.lon.values, st.lat.values, v) for k, v in frames.items()}
    vrange = paper_range(list(F.values()))                             # plot.py fig_b와 같은 규칙(전 패널 1–99 백분위)
    norm, cmap = Normalize(*vrange), plt.get_cmap("coolwarm").with_extremes(bad=(0, 0, 0, 0))
    pw = 2.4
    ph = pw * (DATA_BOX[3] - DATA_BOX[2]) / (DATA_BOX[1] - DATA_BOX[0]) / np.cos(np.radians(np.mean(MAP_EXTENT[2:])))
    for k, f in F.items():
        fig = plt.figure(figsize=(pw, ph), dpi=dpi)
        ax = fig.add_axes([0, 0, 1, 1], projection=ccrs.PlateCarree())
        draw_map(ax, f, norm, cmap, left=False, bottom=False)
        strip_axes(ax)
        save_map(fig, out / f"{k}.png", dpi)
    meta = {"start_kst": f"{CASE:%Y-%m-%d %H:%M}", "leads": list(LEADS), "unit": "°C", "vmin": vrange[0],
            "vmax": vrange[1], "gradient": hexes(plt.get_cmap("coolwarm"), 32),
            "ticks": ticks(*vrange)}
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    print("nowcast vrange", vrange)


# ── 4. 관측소 분포 지도 (그림 2) ────────────────────────────────────
LAND_BOX = (122.5, 30.8, 133.2, 39.6)   # 서·남·동·북 — 지도에 그리는 육지 범위


def observed_stations(year: int) -> list[dict]:
    """plot_paper_domain.observed_lonlat과 같은 선정(표본 시각 50% 이상 관측) — 지상은 ASOS·AWS를 IS_ASOS로 나눠 이름·해발까지 남긴다."""
    import csv
    from collections import defaultdict
    import export_paper_tiles as ept
    import plot_paper_domain as ppd
    master = {k: {r["STN_ID"]: r for r in ept.read_stations(n)} for k, n in [("G", "ground_stn"), ("P", "pm10_stn"), ("U", "UPP_stn")]}
    seen, sea, sea_name = defaultdict(int), defaultdict(list), {}
    times = [f"{year}{m:02d}{d:02d}{h:02d}" for m in range(1, 13) for d in ppd.SAMPLE_DAYS for h in ppd.SAMPLE_HOURS]
    for tm in times:
        for src, col in [("ASOS", "STN"), ("AWS", "STN"), ("PM10", "STN"), ("SEA", "STN_ID"), ("UPP", "STN")]:
            t = tm[:8] + ppd.UPP_HOUR[tm[8:]] if src == "UPP" else tm
            path = ppd.OBS / src / t[:4] / t[4:6] / f"{src}_{t}00.csv"
            if not path.exists():
                continue
            with open(path, encoding="utf-8", errors="replace") as fh:
                rows = [r for r in csv.DictReader(fh) if (r.get("TM") or "").strip() == t + "00"]
            keys = set()
            for r in rows:
                stn = r[col].strip()
                if src != "SEA":
                    kind = {"PM10": "P", "UPP": "U"}.get(src, "G")
                    if stn in master[kind]:
                        keys.add((kind, stn))
                    continue
                try:
                    lon, lat = float(r["LON"]), float(r["LAT"])
                except (KeyError, ValueError):
                    continue
                if lon > 100 and lat > 20:
                    keys.add(("S", stn))
                    sea[stn].append((lon, lat))
                    sea_name[stn] = r.get("STN_KO", "").strip()
            for k in keys:
                seen[k] += 1
    out = []
    for kind, stn in sorted(k for k, n in seen.items() if n >= len(times) / 2):
        if kind == "S":
            lon, lat = np.median(sea[stn], axis=0)
            out.append({"k": "SEA", "id": stn, "n": sea_name[stn], "lon": round(float(lon), 4), "lat": round(float(lat), 4), "h": None})
            continue
        r = master[kind][stn]
        k = {"P": "PM10", "U": "UPP"}.get(kind) or ("ASOS" if r.get("IS_ASOS") == "1" else "AWS")
        h = float(r["HT"]) if (r.get("HT") or "").strip() else None
        out.append({"k": k, "id": stn, "n": r["STN_KO"].strip(), "lon": round(r["lon"], 4), "lat": round(r["lat"], 4), "h": h})
    return out


def land_geojson() -> dict:
    """Natural Earth 10m 육지를 LAND_BOX로 자르고 단순화한 GeoJSON (좌표 소수 3자리)."""
    import cartopy.feature as cfeature
    from shapely.geometry import box, mapping
    from shapely.ops import unary_union
    clip = box(*LAND_BOX)
    land = unary_union([g.intersection(clip) for g in cfeature.LAND.with_scale("10m").intersecting_geometries(
        [LAND_BOX[0], LAND_BOX[2], LAND_BOX[1], LAND_BOX[3]])]).simplify(0.004)
    geom = json.loads(json.dumps(mapping(land)), parse_float=lambda s: round(float(s), 3))
    return {"type": "Feature", "properties": {"source": "Natural Earth 10m land"}, "geometry": geom}


def make_stations() -> None:
    from collections import Counter
    from plot_paper_domain import OBS_YEAR
    st = observed_stations(OBS_YEAR)
    print("stations", OBS_YEAR, dict(Counter(s["k"] for s in st)))
    (OUT / "stations.json").write_text(json.dumps({"year": OBS_YEAR, "stations": st}, ensure_ascii=False,
                                                  separators=(",", ":")), encoding="utf-8")
    (OUT / "land.json").write_text(json.dumps(land_geojson(), separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    jobs = {"try": make_try, "swipe": make_swipe, "nowcast": make_nowcast, "stations": make_stations}
    for j in sys.argv[1:] or jobs:
        jobs[j]()
