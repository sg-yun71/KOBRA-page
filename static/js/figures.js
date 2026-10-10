// Interactive figures (D3 v7): pipeline (Fig. 1), station map (Fig. 2), platform hotspots (Figs. 6, 8).
// Data: static/demo/{stations,land}.json and static/demo/try/*, built by tools/make_demo_data.py
(function () {
  'use strict';
  var BASE = 'static/demo/';
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function json(u) { return fetch(BASE + u).then(function (r) { return r.json(); }); }

  // 관측망 — 그리는 순서 = 아래→위 (고층은 사각형으로 맨 위)
  var KINDS = [
    { k: 'AWS', label: 'AWS', ko: '방재기상관측(AWS)', color: '#6f97d8', sym: d3.symbolCircle, size: 16 },
    { k: 'ASOS', label: 'ASOS', ko: '종관기상관측(ASOS)', color: '#1b2a4a', sym: d3.symbolCircle, size: 30 },
    { k: 'PM10', label: 'PM10', ko: '황사관측(PM10)', color: '#c98a12', sym: d3.symbolDiamond, size: 44 },
    { k: 'SEA', label: 'Marine', ko: '해양 관측', color: '#e8762b', sym: d3.symbolTriangle, size: 36 },
    { k: 'UPP', label: 'Upper-air', ko: '고층 관측(라디오존데)', color: '#d62728', sym: d3.symbolSquare, size: 80 }
  ];
  var KIND = {};
  KINDS.forEach(function (d) { KIND[d.k] = d; });
  var EXTENT = { type: 'MultiPoint', coordinates: [[123.2, 31.6], [132.0, 38.75]] };

  function projection(w, h, pad) {   // EPSG:5179(UTM-K)와 같은 중앙 경선 127.5°
    return d3.geoTransverseMercator().rotate([-127.5, -38]).fitExtent([[pad, pad], [w - pad, h - pad]], EXTENT);
  }
  function symbol(d, scale) { return d3.symbol(KIND[d.k].sym, KIND[d.k].size * (scale || 1))(); }
  function fmt(x) { return x.toFixed(2); }

  // ---- A. 관측소 분포 지도 ----
  function stationMap(root, land, data) {
    var W = 640, H = 600, proj = projection(W, H, 10), path = d3.geoPath(proj);
    var st = data.stations.map(function (s) { var p = proj([s.lon, s.lat]); return Object.assign({ x: p[0], y: p[1] }, s); });
    var svg = d3.select(root.querySelector('svg')).attr('viewBox', [0, 0, W, H]);
    var g = svg.append('g');
    g.append('path').datum(land).attr('d', path).attr('fill', '#e6eaf0').attr('stroke', '#9aa3ad')
      .attr('stroke-width', 0.6).attr('vector-effect', 'non-scaling-stroke');
    var on = {}, k = 1, sel = null, visible = [], delaunay = null;
    var pts = g.append('g').selectAll('path').data(st.slice().sort(function (a, b) {
      return KINDS.indexOf(KIND[a.k]) - KINDS.indexOf(KIND[b.k]); }))
      .join('path').attr('d', function (d) { return symbol(d); }).attr('fill', function (d) { return KIND[d.k].color; })
      .attr('stroke', function (d) { return d.k === 'UPP' ? '#fff' : 'none'; }).attr('stroke-width', 1);
    var ring = g.append('circle').attr('fill', 'none').attr('stroke', '#111').attr('stroke-width', 1.6).attr('r', 7).attr('display', 'none');
    var readout = root.querySelector('.demo-readout');
    var EMPTY = '점에 마우스를 올리거나 누르면 지점 이름, 관측 종류, 위치를 볼 수 있다';

    function place() {
      pts.attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ') scale(' + (1 / Math.sqrt(k)) + ')'; });
      ring.attr('r', 7 / k).attr('stroke-width', 1.6 / k);
    }
    function show(d) {
      sel = d;
      if (!d) { ring.attr('display', 'none'); readout.textContent = EMPTY; return; }
      ring.attr('display', null).attr('cx', d.x).attr('cy', d.y);
      readout.innerHTML = '<b>' + d.n + '</b> · ' + KIND[d.k].ko + '<br>' + fmt(d.lat) + '°N, ' + fmt(d.lon) + '°E' +
        (d.h === null ? '' : ' · 해발 ' + Math.round(d.h) + ' m');
    }
    function refresh() {
      visible = st.filter(function (d) { return on[d.k]; }).sort(function (a, b) { return a.lon - b.lon; });
      delaunay = d3.Delaunay.from(visible, function (d) { return d.x; }, function (d) { return d.y; });
      pts.attr('display', function (d) { return on[d.k] ? null : 'none'; });
      if (sel && !on[sel.k]) show(null);
    }

    // 범례 겸 토글
    var pills = root.querySelector('.pills');
    KINDS.slice().reverse().forEach(function (K) {
      on[K.k] = true;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pill tog';
      b.dataset.k = K.k;
      b.setAttribute('aria-pressed', 'true');
      b.innerHTML = '<svg class="sw" viewBox="-6 -6 12 12" aria-hidden="true"><path d="' + d3.symbol(K.sym, 40)() + '" fill="' + K.color + '"/></svg>' +
        K.label;   // 개수는 표 1과 기준(2024년 관측 비율)이 달라 표시하지 않는다
      b.setAttribute('aria-label', K.ko + ' 표시');
      b.addEventListener('click', function () {
        on[K.k] = !on[K.k];
        b.setAttribute('aria-pressed', on[K.k]);
        refresh();
      });
      pills.appendChild(b);
    });

    // 확대·이동: 휠은 Ctrl(⌘)과 함께, 터치는 두 손가락 — 페이지 스크롤을 가로채지 않게
    var zoom = d3.zoom().scaleExtent([1, 12]).translateExtent([[0, 0], [W, H]])
      .filter(function (e) {
        if (e.type === 'wheel') return e.ctrlKey || e.metaKey;
        if (e.type === 'touchstart') return e.touches.length > 1;
        return !e.button;
      })
      .on('zoom', function (e) { k = e.transform.k; g.attr('transform', e.transform); place(); });
    svg.call(zoom).style('touch-action', 'pan-x pan-y');
    function pick(e) {
      var t = d3.zoomTransform(svg.node()), p = t.invert(d3.pointer(e, svg.node()));
      var i = delaunay.find(p[0], p[1]), d = visible[i];
      show(d && Math.hypot(d.x - p[0], d.y - p[1]) * k < 14 ? d : (e.type === 'click' ? null : sel));
    }
    svg.on('pointermove', function (e) { if (e.pointerType === 'mouse') pick(e); }).on('click', pick);
    function zoomBy(f) { svg.transition().duration(REDUCE ? 0 : 250).call(zoom.scaleBy, f); }
    root.querySelector('.z-in').addEventListener('click', function () { zoomBy(1.6); });
    root.querySelector('.z-out').addEventListener('click', function () { zoomBy(1 / 1.6); });
    root.querySelector('.z-reset').addEventListener('click', function () { svg.transition().duration(REDUCE ? 0 : 250).call(zoom.transform, d3.zoomIdentity); });
    svg.on('keydown', function (e) {   // ←→ 지점 이동(경도 순), +/− 확대, 0 원래대로
      var step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (step && visible.length) {
        var i = sel ? visible.indexOf(sel) : -1;
        show(visible[(i + step + visible.length) % visible.length]);
      } else if (e.key === '+' || e.key === '=') zoomBy(1.6);
      else if (e.key === '-') zoomBy(1 / 1.6);
      else if (e.key === '0') svg.call(zoom.transform, d3.zoomIdentity);
      else if (e.key === 'Escape') show(null);
      else return;
      e.preventDefault();
    });
    // 관측 카드 → 그 관측망만 강조(나머지 흐리게). reveal이면 꺼진 관측망을 토글로 켠다
    root.focusNet = function (key, reveal) {
      if (key && reveal && !on[key]) pills.querySelector('[data-k="' + key + '"]').click();
      pts.attr('opacity', function (d) { return !key || d.k === key ? 1 : 0.12; });
    };
    place();
    refresh();
    show(null);
  }

  // ---- A-2. 관측 종류 카드 (펼친 카드 = 지도 강조, 호버는 잠시 강조) ----
  function obsCards(root) {
    function current() { var o = root.querySelector('details.obs[open]'); return o ? o.dataset.k : null; }
    root.querySelectorAll('details.obs').forEach(function (c) {
      var K = KIND[c.dataset.k];
      c.querySelector('summary').insertAdjacentHTML('afterbegin', '<svg class="sw" viewBox="-6 -6 12 12" aria-hidden="true"><path d="' +
        d3.symbol(K.sym, 40)() + '" fill="' + K.color + '"/></svg>');
      c.addEventListener('toggle', function () { root.focusNet(current(), true); });
      c.addEventListener('mouseenter', function () { root.focusNet(c.dataset.k); });
      c.addEventListener('mouseleave', function () { root.focusNet(current()); });
    });
  }

  // ---- A-3. 변수 구성 (static/demo/channels.json ← tools/make_channels.py) ----
  function channelList(root, data) {
    root.innerHTML = data.blocks.map(function (b) {
      return '<div><p class="ch-h">' + b.label + ' <b>' + b.count + '</b>채널</p>' + b.groups.map(function (g) {
        return '<details class="ch"><summary>' + g.label + '<span class="ch-n">' + g.channels.length + '</span></summary>' +
          '<p class="ch-note">' + g.note + '</p><ul class="ch-l">' + g.channels.map(function (c) {
            return '<li>' + c[1] + (c[2] === 'code' || c[2] === 'index' ? '' : ' <span class="ch-u">' + c[2] + '</span>') + '<code>' + c[0] + '</code></li>';
          }).join('') + '</ul></details>';
      }).join('') + '</div>';
    }).join('');
  }

  // ---- B. 파이프라인 (그림 1) ----
  var DETAIL = [
    { t: '1. 관측 수집', items: [['지상 관측', '종관·방재·황사'], ['해양 관측', '부이·등표'], ['고층 관측', '라디오존데'], ['전처리', '결측·측정 오류 제외']],
      links: [['#dataset', '관측소 분포 (Figure 2)']] },
    { t: '2. 데이터셋 구축', items: [['보간 방법 선택', '관측 지점 수·변수 특성·지형에 따라 변수마다 방법 설정'], ['격자화', '매 시각 공간 보간을 수행·변수마다 한 채널']],
      links: [['#dataset', '데이터셋 구축'], ['#try-kobra', 'Try KOBRA']] },
    { t: '3. 저장', items: [['다차원 데이터셋', '모든 관측 변수를 채널로 1시간 단위로 저장']],
      links: [['#try-kobra', 'Try KOBRA']] },
    { t: '4. 추출', items: [['추출 범위 지정', '데이터셋·변수·기간·영역'], ['KOBRA를 통한 추출·제공', '지정한 조건의 데이터만 웹 화면·API로 제공'], ['데이터 확인·파일 내려받기', '']],
      links: [['#platform', '플랫폼 화면 (Figures 6, 8)']] },
    { t: '5. 검증·활용', items: [['교차검증', '미관측 지점의 정확도 평가'], ['ERA5와 비교', '격자 안 국지 기상의 표현 확인'], ['초단기 예측 학습', '학습 데이터로 활용']],
      links: [['#acc-cv', '4.1 데이터셋 검증'], ['#acc-local', '4.2 국지 기상 표현 비교'], ['#nowcasting', '4.3 다운스트림 태스크']] }
  ];

  function tryCanvas(meta, bufs, key, t) {
    var W = meta.W, H = meta.H, N = W * H, d = bufs[key], lut = meta.vars[key].lut;
    var c = document.createElement('canvas'), ctx = c.getContext('2d'), img = ctx.createImageData(W, H);
    c.width = W; c.height = H;
    for (var i = 0; i < N; i++) {
      var h = lut[d[t * N + i]];   // 255(값 없음)은 lut 밖 → 투명
      if (!h) continue;
      img.data.set([parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16), 255], i * 4);
    }
    ctx.putImageData(img, 0, 0);
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  function pipelineVisuals(root, land, data) {
    var W = 200, H = 190, proj = projection(W, H, 4);
    var svg = d3.select(root.querySelector('.mini-stn')).attr('viewBox', [0, 0, W, H]);
    svg.append('path').datum(land).attr('d', d3.geoPath(proj)).attr('fill', '#eef0f3').attr('stroke', '#aab2bd').attr('stroke-width', 0.4);
    svg.append('g').selectAll('path').data(data.stations.slice().sort(function (a, b) {
      return KINDS.indexOf(KIND[a.k]) - KINDS.indexOf(KIND[b.k]); }))
      .join('path').attr('transform', function (d) { var p = proj([d.lon, d.lat]); return 'translate(' + p + ')'; })
      .attr('d', function (d) { return symbol(d, 0.35); }).attr('fill', function (d) { return KIND[d.k].color; });

    var T = 14, KEYS = ['PA_1H', 'WS_1H', 'HM_1H', 'TA_1H'];   // 2024-07-15 14시 — 큐브는 뒤→앞
    json('try/meta.json').then(function (meta) {
      return Promise.all(KEYS.map(function (key) {
        return fetch(BASE + 'try/' + meta.vars[key].file).then(function (r) { return r.arrayBuffer(); });
      })).then(function (list) {
        var bufs = {};
        KEYS.forEach(function (key, i) { bufs[key] = new Uint8Array(list[i]); });
        root.querySelector('.mini-grid').prepend(tryCanvas(meta, bufs, 'TA_1H', T));
        var cube = root.querySelector('.cube');
        KEYS.forEach(function (key, i) {
          var c = tryCanvas(meta, bufs, key, T);
          c.style.left = (3 - i) * 9 + '%';
          c.style.top = i * 8 + '%';
          cube.appendChild(c);
        });
        var full = tryCanvas(meta, bufs, 'TA_1H', T), BOX = [98, 66, 26, 22];   // 추출 영역 예: 부산·경남 해안 (격자 칸)
        root.querySelector('.ex-full').prepend(full);
        var sel = root.querySelector('.ex-box');
        sel.style.left = BOX[0] / meta.W * 100 + '%';
        sel.style.top = BOX[1] / meta.H * 100 + '%';
        sel.style.width = BOX[2] / meta.W * 100 + '%';
        sel.style.height = BOX[3] / meta.H * 100 + '%';
        var z = document.createElement('canvas');
        z.width = BOX[2]; z.height = BOX[3];
        z.getContext('2d').drawImage(full, BOX[0], BOX[1], BOX[2], BOX[3], 0, 0, BOX[2], BOX[3]);
        z.setAttribute('aria-hidden', 'true');
        root.querySelector('.ex-zoom').appendChild(z);
      });
    });
  }

  function pipeline(root) {
    var heads = Array.prototype.slice.call(root.querySelectorAll('.ph'));
    var cells = root.querySelectorAll('.pc'), detail = root.querySelector('.pipe-detail'), timer = null;
    function set(s) {
      heads.forEach(function (h, i) { h.classList.toggle('done', i <= s); h.setAttribute('aria-pressed', i === s); });
      cells.forEach(function (c) { var i = +c.dataset.s; c.classList.toggle('dim', i > s); c.classList.toggle('on', i === s); });
      var d = DETAIL[s];
      detail.innerHTML = '<p class="pd-h">' + d.t + '</p><ul class="pd-l">' + d.items.map(function (x) {
        return '<li><b>' + x[0] + '</b>' + (x[1] ? ' — ' + x[1] : '') + '</li>'; }).join('') + '</ul><p class="pd-links">' +
        d.links.map(function (x) { return '<a href="' + x[0] + '">' + x[1] + ' &rarr;</a>'; }).join('') + '</p>';
    }
    function user(s) { clearInterval(timer); timer = null; set(s); }
    heads.forEach(function (h, i) {
      h.addEventListener('click', function () { user(i); });
      h.addEventListener('mouseenter', function () { user(i); });
      h.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { var n = (i + d + heads.length) % heads.length; heads[n].focus(); user(n); e.preventDefault(); }
      });
    });
    cells.forEach(function (c) {
      c.addEventListener('mouseenter', function () { user(+c.dataset.s); });
      c.addEventListener('click', function () { user(+c.dataset.s); });
    });
    set(4);
    if (REDUCE || !('IntersectionObserver' in window)) return;
    set(0);   // 처음 보일 때 1→5로 한 번 진행
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      var s = 0;
      timer = setInterval(function () { set(++s); if (s >= 4) { clearInterval(timer); timer = null; } }, 650);
    }, { threshold: 0.4 });
    io.observe(root);
  }

  // ---- D. 플랫폼 화면 핫스팟 (그림 6·8 캡션의 번호 중 캡처에 보이는 것, 문구는 캡션 항목명 그대로) ----
  var SPOTS = {
    'pf-explore': [
      [23.1, 9.8, '①', '데이터셋 선택'],
      [18.8, 25.4, '②', '변수 선택'],
      [36.9, 24, '③', '격자 지도'],
      [95.3, 88.1, '⑤', '표시 변수 설정'],
      [79, 94, '⑥', '색상 범례'],
      [31.3, 92.5, '⑦', '시간 탐색']
    ],
    'pf-relations': [
      [16.4, 21.5, '①', '기준 변수 선택'],
      [83, 8.8, '②', '기간 선택'],
      [20.6, 17.5, '③', '상관 변수 시계열'],
      [18.1, 60, '④', '상관 변수 목록']
    ],
    'pf-terms': [
      [18.75, 19, '①', '절기별 값'],
      [81.6, 15.1, '②', '비교 연도 선택']
    ]
  };

  function hotspots(panel, spots) {
    var wrap = panel.querySelector('.shot-wrap'), pop = document.createElement('div'), pinned = null;
    pop.className = 'hs-pop';
    pop.id = panel.id + '-pop';
    pop.setAttribute('role', 'tooltip');
    pop.hidden = true;
    wrap.appendChild(pop);
    function open(b, s) {
      pop.innerHTML = '<b>' + s[2] + ' ' + s[3] + '</b>';
      pop.hidden = false;
      pop.style.left = s[0] + '%';
      pop.style.top = s[1] + '%';
      pop.style.transform = 'translate(' + (s[0] > 60 ? 'calc(-100% - 18px)' : '18px') + ',' + (s[1] > 70 ? 'calc(-100% + 8px)' : '-8px') + ')';
      wrap.querySelectorAll('.hs').forEach(function (x) { x.classList.toggle('on', x === b); });
    }
    function close() {
      pinned = null;
      pop.hidden = true;
      wrap.querySelectorAll('.hs').forEach(function (x) { x.classList.remove('on'); });
    }
    spots.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'hs';
      b.textContent = s[2];
      b.style.left = s[0] + '%';
      b.style.top = s[1] + '%';
      b.setAttribute('aria-label', s[2] + ' ' + s[3]);
      b.setAttribute('aria-describedby', pop.id);
      b.addEventListener('mouseenter', function () { if (!pinned) open(b, s); });
      b.addEventListener('mouseleave', function () { if (!pinned) close(); });
      b.addEventListener('focus', function () { open(b, s); });
      b.addEventListener('blur', function () { if (pinned !== b) close(); });
      b.addEventListener('click', function () { if (pinned === b) return close(); open(b, s); pinned = b; });
      b.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
      wrap.appendChild(b);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var pipe = document.getElementById('pipeline');
    pipeline(pipe);
    Object.keys(SPOTS).forEach(function (id) { hotspots(document.getElementById(id), SPOTS[id]); });
    Promise.all([json('land.json'), json('stations.json')]).then(function (r) {
      var sm = document.getElementById('station-map');
      stationMap(sm, r[0], r[1]);
      obsCards(sm);
      pipelineVisuals(pipe, r[0], r[1]);
    });
    json('channels.json').then(function (d) { channelList(document.getElementById('channels'), d); });
  });
})();
