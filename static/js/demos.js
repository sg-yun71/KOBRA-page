// Interactive demos (static, browser-only). Data: static/demo/*, built by tools/make_demo_data.py
(function () {
  'use strict';
  var BASE = 'static/demo/';

  function legend(el, lg, unit) {
    var bar = lg.steps
      ? '<div class="demo-legend-bar" style="display:flex">' + lg.steps.map(function (c) {
          return '<span style="flex:1;background:' + c + '"></span>'; }).join('') + '</div>'
      : '<div class="demo-legend-bar" style="background:linear-gradient(to right,' + lg.gradient.join(',') + ')"></div>';
    var ticks = lg.ticks.map(function (t) {
      return '<span style="left:' + (t[0] * 100).toFixed(2) + '%">' + t[1].replace('-', '−') + '</span>';
    }).join('');
    el.innerHTML = '<div class="demo-legend-inner">' + bar + '<div class="demo-legend-ticks">' + ticks +
      '</div></div><span class="demo-legend-unit">' + unit + '</span>';
  }

  function player(button, slider, ms) {
    var timer = null;
    function label() {
      button.innerHTML = timer ? '&#10074;&#10074; Pause' : '&#9654; Play';
      button.setAttribute('aria-pressed', !!timer);
    }
    function stop() { clearInterval(timer); timer = null; label(); }
    button.addEventListener('click', function () {
      if (timer) return stop();
      timer = setInterval(function () {
        var v = +slider.value + 1;
        slider.value = v > +slider.max ? slider.min : v;
        slider.dispatchEvent(new Event('input'));
      }, ms);
      label();
    });
    label();
    slider.addEventListener('keydown', stop);
    slider.addEventListener('pointerdown', stop);
  }

  function hexRGBA(h) {
    return h ? [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16), 255] : [0, 0, 0, 0];
  }

  // ---- 1. Try KOBRA: 5 km map viewer ----
  function tryKobra(root) {
    var dir = BASE + 'try/';
    fetch(dir + 'meta.json').then(function (r) { return r.json(); }).then(function (meta) {
      var W = meta.W, H = meta.H, N = W * H, names = Object.keys(meta.vars);
      var canvas = root.querySelector('canvas'), ctx = canvas.getContext('2d'), img = ctx.createImageData(W, H);
      var slider = root.querySelector('input[type=range]'), timeEl = root.querySelector('.demo-time-label');
      var readout = root.querySelector('.demo-readout'), btns = root.querySelector('.pills');
      var data = {}, luts = {}, lonlat = null, cur = names[0], hover = -1;
      canvas.width = W; canvas.height = H;

      names.forEach(function (k) {
        var v = meta.vars[k], lut = new Uint8ClampedArray(256 * 4);
        v.lut.forEach(function (h, i) { lut.set(hexRGBA(h), i * 4); });
        luts[k] = lut;  // index 255 (nodata) stays transparent
        var b = document.createElement('button');
        b.className = 'pill';
        b.type = 'button';
        b.dataset.k = k;
        b.textContent = v.name;
        b.addEventListener('click', function () { cur = k; draw(); });
        btns.appendChild(b);
      });

      function value(k, code) {
        if (code === meta.nodata) return null;
        var v = meta.vars[k], x = code * v.scale + v.offset;
        return v.transform === 'sqrt' ? x * x : x;
      }

      function showHover() {
        var t = +slider.value, k = cur, v = meta.vars[k];
        var when = meta.date + ' ' + meta.times[t] + ' ' + meta.timezone;
        if (hover < 0 || !data[k] || !lonlat) { readout.textContent = '지도에 마우스를 올리면 격자 값을 볼 수 있다 · ' + when; return; }
        var x = value(k, data[k][t * N + hover]);
        var digits = k === 'HM_1H' || k === 'PA_1H' ? 0 : 1;   // PA 양자화 간격 0.6 hPa
        var val = x === null ? '값 없음' : x.toFixed(digits).replace('-', '−') + ' ' + v.unit;
        readout.textContent = v.name_ko + ' ' + val + ' · ' + lonlat[N + hover].toFixed(2) + '°N, ' +
          lonlat[hover].toFixed(2) + '°E · ' + when;
      }

      function draw() {
        var t = +slider.value, v = meta.vars[cur];
        timeEl.textContent = meta.times[t] + ' KST';
        slider.setAttribute('aria-valuetext', meta.date + ' ' + meta.times[t] + ' KST');
        btns.querySelectorAll('button').forEach(function (b) {
          var on = b.dataset.k === cur;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-pressed', on);
        });
        canvas.setAttribute('aria-label', 'KOBRA 5 km ' + v.name_ko + ' 지도, ' + meta.date + ' ' + meta.times[t] + ' KST');
        legend(root.querySelector('.demo-legend'), v.legend, v.unit);
        if (!data[cur]) {
          fetch(dir + v.file).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
            data[cur] = new Uint8Array(buf); draw();
          });
          return;
        }
        var d = data[cur], lut = luts[cur], px = img.data;
        for (var i = 0; i < N; i++) {
          var c = d[t * N + i] * 4;
          px[i * 4] = lut[c]; px[i * 4 + 1] = lut[c + 1]; px[i * 4 + 2] = lut[c + 2]; px[i * 4 + 3] = lut[c + 3];
        }
        ctx.putImageData(img, 0, 0);
        showHover();
      }

      canvas.addEventListener('mousemove', function (e) {
        var r = canvas.getBoundingClientRect();
        var col = Math.floor((e.clientX - r.left) / r.width * W), row = Math.floor((e.clientY - r.top) / r.height * H);
        hover = col >= 0 && col < W && row >= 0 && row < H ? row * W + col : -1;
        showHover();
      });
      canvas.addEventListener('mouseleave', function () { hover = -1; showHover(); });
      slider.max = meta.times.length - 1;
      slider.addEventListener('input', draw);
      player(root.querySelector('.demo-play'), slider, 700);
      fetch(dir + 'lonlat.bin').then(function (r) { return r.arrayBuffer(); }).then(function (b) { lonlat = new Float32Array(b); });
      draw();
    });
  }

  // ---- 2. ERA5 vs KOBRA swipe ----
  function swipe(root) {
    var input = root.querySelector('input[type=range]'), top = root.querySelector('.swipe-top'), handle = root.querySelector('.swipe-handle');
    function set() {
      top.style.clipPath = 'inset(0 ' + (100 - input.value) + '% 0 0)';
      handle.style.left = input.value + '%';
    }
    input.addEventListener('input', set);
    set();
    fetch(BASE + 'swipe/meta.json').then(function (r) { return r.json(); }).then(function (m) {
      legend(root.querySelector('.demo-legend'), m, m.unit);
    });
  }

  // ---- 3. Nowcast player ----
  function nowcast(root) {
    var RMSE = { 1: '1.32', 2: '1.49', 3: '1.69', 4: '1.88', 5: '2.08', 6: '2.27' };  // Table 5, U-Net air temperature
    var slider = root.querySelector('input[type=range]'), truth = root.querySelector('.nc-truth'), pred = root.querySelector('.nc-pred');
    var label = root.querySelector('.demo-time-label'), rmse = root.querySelector('.nc-rmse');
    for (var L = 1; L <= 6; L++) { new Image().src = BASE + 'nowcast/truth_' + L + '.png'; new Image().src = BASE + 'nowcast/pred_' + L + '.png'; }
    function show() {
      var L = +slider.value, hh = ('0' + (9 + L)).slice(-2) + ':00 KST';
      truth.src = BASE + 'nowcast/truth_' + L + '.png';
      pred.src = BASE + 'nowcast/pred_' + L + '.png';
      truth.alt = '실제값 기온, +' + L + ' h';
      pred.alt = 'U-Net 예측 기온, +' + L + ' h';
      label.textContent = '+' + L + ' h (' + hh + ')';
      slider.setAttribute('aria-valuetext', '+' + L + '시간, ' + hh);
      rmse.textContent = RMSE[L] + ' °C';
    }
    slider.addEventListener('input', show);
    player(root.querySelector('.demo-play'), slider, 1200);
    show();
    fetch(BASE + 'nowcast/meta.json').then(function (r) { return r.json(); }).then(function (m) {
      legend(root.querySelector('.demo-legend'), m, m.unit);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    tryKobra(document.getElementById('try-demo'));
    swipe(document.getElementById('swipe-demo'));
    nowcast(document.getElementById('nowcast-demo'));
  });
})();
