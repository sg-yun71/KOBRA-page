# KOBRA — Project Page

Project page for **"KOBRA: A Korean Observation-Based Regional Atmospheric Data Platform"**
(Journal of the Korean Institute of Communications and Information Sciences, submitted).

## Contents

| Path | What it is |
|---|---|
| `index.html` | Paper-page layout: Try KOBRA (teaser) → Abstract → Overview (interactive Figure 1 pipeline) → Dataset (interactive Figure 2 station map with expandable observation-network cards, Table 1, interpolation summary, channel list) → Platform (screens in place of Figures 6 and 8, numbered hotspots) → Experiments: 4.1 (Figure 10 chart, Table 2), 4.2 (ERA5 vs KOBRA swipe + cross-section chart = Figure 11, Table 3, Figure 12 chart), 4.3 (nowcast player = Figure 13, Table 5 chart and table) → Conclusion. Figure and table numbers follow the paper; captions are the final Korean captions. Section headings, buttons and chart labels in English; body text, captions and tables in Korean |
| `static/pdf/KOBRA_paper.pdf` | Submitted manuscript (linked from the **Paper** button) |
| `static/images/figure01–13.png` | Paper figures, web size (≤1,800 px); `static/images/full/` holds the originals opened in the lightbox. Kept for reference; the page itself shows none of them (Figure 11(b) is now an interactive chart) |
| `static/images/platform/` | Clean platform screenshots (Explore, Analyze · Relations, Analyze · Solar terms) |
| `static/demo/` | Data for the interactive demos (≈6 MB), `stations.json` + `land.json` (Figure 2 station map) `charts.json` (numbers for the four result charts) and `channels.json` (Dataset channel list) |
| `static/js/demos.js` | Demo logic (no external libraries) |
| `static/js/figures.js` | D3 v7 (cdnjs) figures: Figure 1 pipeline, Figure 2 station map, platform screen hotspots (Figures 6 and 8) |
| `static/js/charts.js` | Result charts (Figure 10, Figure 11(b), Figure 12, Table 5) with Chart.js 4.4.1 from cdnjs |
| `tools/make_demo_data.py` | Regenerates `static/demo/{try,swipe,nowcast}` from the KOBRA datasets (needs the `weather_data_platform` repo and its data next to this folder; `weather_exp` env for cartopy): `python tools/make_demo_data.py [try|swipe|nowcast|stations]`. `stations` writes `stations.json` with the stations of Figure 2 (`plot_paper_domain.py` selection: observed at ≥ 50 % of the 2024 sample hours; surface split into ASOS/AWS by `IS_ASOS`) and `land.json` (Natural Earth 10m land, clipped and simplified) |
| `tools/make_chart_data.py` | Rebuilds `static/demo/charts.json` from the experiment result files in `weather_data_platform/experiments/revision_20261002/`: `python tools/make_chart_data.py`. The Figure 11(b) cross-section (Hongcheon–Gangneung, 15 KST 25 Jan 2023) is re-sampled with `compare_fields.py` (`export_fig8_layers` sampling) from `static_500m.nc`, ERA5 and the 500 m store on the NAS, so that step needs the `data` link |
| `tools/make_channels.py` | Rebuilds `static/demo/channels.json` from `weather_data_platform/src/catalog/catalog.yaml` (73 surface/marine + 31 upper-air channels; the 5 static channels are not part of the paper's 104): `python tools/make_channels.py` |
| `tools/capture_platform.py` | Recaptures `static/images/platform/` (platform server on :8010 first): `python tools/capture_platform.py` |

## Interactive demos

All demos and figures run in the browser on static files, so the page works on GitHub Pages without a server.

- **Try KOBRA** — 5 km dataset, 15 July 2024 (KST), 24 hours of air temperature, relative humidity, wind speed, 1-h precipitation, station pressure, 850 hPa temperature and 850 hPa wind speed. Pick a variable, move the time slider, hover for values.
- **ERA5 vs KOBRA swipe (Figure 11(a))** — the Figure 11 case (Taebaek Mountains, 15 KST 25 January 2023): ERA5 (0.25°) against KOBRA (500 m) with a draggable divider.
- **Pipeline (Figure 1)** — hover or click a stage to highlight it and see its items; the mini maps use the Try KOBRA data and `stations.json`.
- **Station map (Figure 2)** — 2024 stations by network (toggles show no counts; Table 1 gives the counts on its own basis): toggle networks, hover or tap a point, zoom with the buttons, Ctrl+wheel or two fingers.
- **Observation cards** — one card per network (Table 1 rows); opening a card highlights that network on the station map.
- **Glossary terms** — dotted-underlined terms show a one-line definition on hover, focus or tap (definitions in `#glossary` in `index.html`).
- **Platform hotspots** — numbered items from the Figure 6 and 8 captions that are visible in each screenshot; each shows only the caption's item name.
- **Nowcast player** — the Figure 13 case (initialized 09 KST 11 September 2025): ground truth and U-Net prediction for +1 to +6 h, with the Table 5 station RMSE.

## Local preview

```bash
python -m http.server 8000
# open http://localhost:8000
```

## Deploy to GitHub Pages

1. Create an empty repository on GitHub (no README, no license).
2. Push this folder:
   ```bash
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
3. In the repository: **Settings → Pages → Source: GitHub Actions**.
   The workflow in `.github/workflows/static.yml` deploys on every push to `main`;
   the page appears at `https://<user>.github.io/<repo>/`.

## TODO

`TODO` comments in `index.html` mark what is left:

- [ ] Authors and affiliations (header shows "Authors TBA")
- [ ] Code link (button points to `#`)
- [ ] BibTeX section (removed until the paper is accepted)
- [ ] `og:url` meta tag once the page URL is known

Built from [paper-page-template](https://github.com/liu-qilong/paper-page-template)
(Academic Project Page Template lineage, CC BY-SA 4.0).
# KOBRA-page
