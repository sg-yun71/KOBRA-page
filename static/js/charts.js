// 결과 차트 4종 (Chart.js). 숫자는 static/demo/charts.json — tools/make_chart_data.py가 실험 결과 파일에서 만든다
(function () {
  'use strict';
  var COLOR = ['#1f5fae', '#e69f00', '#c4421a'];   // 1번 = KOBRA / U-Net, validate_palette.js 통과 (주황 대비 부족 → 표 보기로 보완)
  var MARK = ['circle', 'rect', 'triangle'];

  function f(v, d) { return v.toFixed(d === undefined ? 2 : d); }

  // 평균선 + (lo~hi) 음영. 음영 데이터셋 이름은 '_'로 시작해 범례·툴팁에서 뺀다
  function series(i, label, mean, lo, hi) {
    var line = { label: label, data: mean, lo: lo, hi: hi, borderColor: COLOR[i], backgroundColor: COLOR[i],
                 pointStyle: MARK[i], pointRadius: 3, pointHoverRadius: 6, borderWidth: 2, fill: false };
    if (!lo) return [line];
    return [{ label: '_lo', data: lo, borderWidth: 0, pointRadius: 0, pointHitRadius: 0, fill: false },
            { label: '_hi', data: hi, borderWidth: 0, pointRadius: 0, pointHitRadius: 0, fill: '-1',
              backgroundColor: COLOR[i] + '2e' },
            line];
  }

  function chart(canvas, xTitle, tip) {
    return new Chart(canvas, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, boxHeight: 7, padding: 16,
                    filter: function (it) { return it.text[0] !== '_'; } } },
          tooltip: { filter: function (it) { return it.dataset.label[0] !== '_'; },
                     backgroundColor: '#1b2a4a', padding: 10, boxPadding: 4, usePointStyle: true,
                     callbacks: { title: tip.title, label: tip.label, footer: tip.footer } }
        },
        scales: {
          x: { title: { display: true, text: xTitle }, grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 10 } },
          y: { title: { display: true, text: '' }, grid: { color: '#e8ecf3' }, border: { display: false } }
        }
      }
    });
  }

  // 변수 버튼 줄: vars = [[key, 버튼 이름, 단위], ...]
  function pills(el, vars, onPick) {
    vars.forEach(function (v, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pill';
      b.textContent = v[1];
      b.addEventListener('click', function () {
        el.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', x === b); });
        onPick(v);
      });
      el.appendChild(b);
      if (i === 0) setTimeout(function () { b.click(); });
    });
  }

  function fig10(root, d) {
    var M = [['builder', 'KOBRA (ours)'], ['idw', 'IDW'], ['nearest', 'Nearest neighbor']], unit = '';
    var c = chart(root.querySelector('canvas'), 'Withheld stations (%)', {
      title: function (it) { return '제외한 관측소 ' + it[0].label + '%'; },
      label: function (it) { var s = it.dataset; return s.label + ' ' + f(it.raw) + ' ' + unit + '  (최소 ' + f(s.lo[it.dataIndex]) + ' – 최대 ' + f(s.hi[it.dataIndex]) + ')'; }
    });
    pills(root.querySelector('.pills'), [['TA_1H', 'Temperature', '°C'], ['HM_1H', 'Humidity', '%p'], ['WS_1H', 'Wind speed', 'm/s'], ['RN_1H', 'Precipitation', 'mm']], function (v) {
      unit = v[2];
      c.data.labels = d.p;
      c.data.datasets = [].concat.apply([], M.map(function (m, i) { var s = d[v[0]][m[0]]; return series(i, m[1], s.mean, s.min, s.max); }));
      c.options.scales.y.title.text = 'RMSE (' + unit + ')';
      c.update();
    });
  }

  function fig12(root, d) {
    var c = chart(root.querySelector('canvas'), 'Station elevation (m)', {
      title: function (it) { return '해발고도 ' + it[0].label + ' m'; },
      label: function (it) { var s = it.dataset; return s.label + ' ' + f(it.raw) + ' °C  (95% 신뢰구간 ' + f(s.lo[it.dataIndex]) + '–' + f(s.hi[it.dataIndex]) + ')'; },
      footer: function (it) { return '관측소 ' + d.n_stn[it[0].dataIndex] + '곳'; }
    });
    c.data.labels = d.bin;
    c.data.datasets = series(0, 'KOBRA (ours)', d.bld, d.bld_lo, d.bld_hi).concat(series(1, 'ERA5', d.era5, d.era5_lo, d.era5_hi));
    c.options.scales.y.title.text = 'RMSE (°C)';
    c.options.scales.y.beginAtZero = true;
    c.update();
  }

  function table5(root, d) {
    var M = [['B', 'U-Net'], ['persist_obs', 'Persistence'], ['clim', 'Climatology']], unit = '';
    var c = chart(root.querySelector('canvas'), 'Lead time', {
      title: function (it) { return it[0].label + ' 예측'; },
      label: function (it) { return it.dataset.label + ' ' + f(it.raw) + ' ' + unit; }
    });
    pills(root.querySelector('.pills'), [['TA', 'Temperature', '°C'], ['WS', 'Wind speed', 'm/s'], ['RN', 'Precipitation', 'mm']], function (v) {
      unit = v[2];
      c.data.labels = ['+1 h', '+2 h', '+3 h', '+4 h', '+5 h', '+6 h'];
      c.data.datasets = [].concat.apply([], M.map(function (m, i) { return series(i, m[1], d[v[0]][m[0]]); }));
      c.options.scales.y.title.text = 'RMSE (' + unit + ')';
      c.update();
    });
  }

  // 그림 11(b) 홍천–강릉 단면: 기온 두 선(왼쪽 축) + 지형 면(오른쪽 축, 아래쪽) + 관측소 점과 위쪽 지명
  function fig11b(root, d) {
    var N = d.x.length, at = {};
    function xy(v) { return d.x.map(function (x, i) { return { x: x, y: v[i] }; }); }
    function t(v) { return f(v, 1).replace('-', '−') + ' °C'; }
    var obs = xy(d.x.map(function () { return null; }));   // 단면과 같은 인덱스에 둬야 index 툴팁이 맞는다
    d.obs.forEach(function (o) {
      var i = 0;
      d.x.forEach(function (x, j) { if (Math.abs(x - o.x) < Math.abs(d.x[i] - o.x)) i = j; });
      obs[i] = { x: o.x, y: o.t };
      at[i] = o.name;
    });
    var names = { id: 'stnNames', beforeDatasetsDraw: function (c) {   // 지명이 겹치면 다음 줄로
      var ctx = c.ctx, top = c.chartArea.top, ends = [-1e9, -1e9, -1e9];
      ctx.save();
      ctx.font = '600 12px ' + Chart.defaults.font.family;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1b2a4a';
      ctx.strokeStyle = '#a3adbd';
      ctx.setLineDash([2, 3]);
      c.getDatasetMeta(2).data.forEach(function (p, i) {
        if (at[i] === undefined) return;
        var w = ctx.measureText(at[i]).width, row = 0;
        while (row < 2 && p.x - w / 2 < ends[row] + 6) row++;
        ends[row] = p.x + w / 2;
        ctx.fillText(at[i], p.x, top - 8 - row * 16);
        ctx.beginPath(); ctx.moveTo(p.x, top - 4 - row * 16 + 2); ctx.lineTo(p.x, p.y - 7); ctx.stroke();
      });
      ctx.restore();
    } };
    var line = { borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, pointHitRadius: 0, fill: false, pointStyle: 'line' };
    new Chart(root.querySelector('canvas'), {
      type: 'line',
      data: { datasets: [
        Object.assign({ label: 'KOBRA (500 m)', data: xy(d.kobra), borderColor: COLOR[0], backgroundColor: COLOR[0], order: 1 }, line),
        Object.assign({ label: 'ERA5 (0.25°)', data: xy(d.era5), borderColor: COLOR[1], backgroundColor: COLOR[1], stepped: 'middle', order: 2 }, line),
        { label: 'Station obs.', data: obs, showLine: false, clip: false, pointRadius: 6, pointHoverRadius: 8, pointStyle: 'circle',
          backgroundColor: '#1b2a4a', borderColor: '#fff', borderWidth: 1.5, order: 0 },
        { label: 'Terrain', data: xy(d.elev), yAxisID: 'y2', fill: 'origin', backgroundColor: '#ebe6dc', borderColor: '#c4baa6',
          borderWidth: 1, pointRadius: 0, pointHoverRadius: 0, pointHitRadius: 0, pointStyle: 'rect', order: 3 }
      ] },
      plugins: [names],
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        layout: { padding: { top: 50 } },
        interaction: { mode: 'index', axis: 'x', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxHeight: 7, padding: 16,
                    sort: function (a, b) { return a.datasetIndex - b.datasetIndex; } } },
          tooltip: { filter: function (it) { return it.datasetIndex < 2; },
                     backgroundColor: '#1b2a4a', padding: 10, boxPadding: 4, usePointStyle: true,
                     callbacks: {
                       title: function (it) { var i = it[0].dataIndex; return '홍천에서 ' + f(d.x[i], 1) + ' km · 해발 ' + Math.round(d.elev[i]) + ' m'; },
                       label: function (it) { return it.dataset.label + ' ' + t(it.raw.y); },
                       footer: function (it) {
                         var x = d.x[it[0].dataIndex];
                         return d.obs.filter(function (o) { return Math.abs(o.x - x) <= 1.5; })
                                     .map(function (o) { return '관측소 ' + o.name + ' ' + t(o.t); });
                       } } }
        },
        scales: {
          x: { type: 'linear', min: 0, max: d.x[N - 1], title: { display: true, text: 'Distance from Hongcheon (km)' },
               grid: { display: false }, ticks: { maxRotation: 0 },
               afterBuildTicks: function (a) { a.ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80].map(function (v) { return { value: v }; }); } },
          y: { min: -25, max: 0, title: { display: true, text: 'Temperature (°C)' }, border: { display: false },
               ticks: { stepSize: 5, callback: function (v) { return v < -15 ? '' : String(v).replace('-', '−'); } },
               grid: { color: function (c) { return c.tick && c.tick.value < -15 ? 'transparent' : '#e8ecf3'; } } },
          y2: { position: 'right', min: 0, max: 2800, grid: { display: false }, border: { display: false },
                afterBuildTicks: function (a) { a.ticks = [0, 500, 1000].map(function (v) { return { value: v }; }); },
                ticks: { callback: function (v) { return v.toLocaleString('en') + ' m'; } } }
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    Chart.defaults.font.family = "'Inter', 'Noto Sans KR', sans-serif";
    Chart.defaults.font.size = 13;
    Chart.defaults.color = '#4a5468';
    fetch('static/demo/charts.json').then(function (r) { return r.json(); }).then(function (d) {
      fig10(document.getElementById('chart-fig10'), d.fig10);
      fig12(document.getElementById('chart-fig12'), d.fig12);
      table5(document.getElementById('chart-table5'), d.table5);
      fig11b(document.getElementById('chart-fig11b'), d.fig11b);
    });
  });
})();
