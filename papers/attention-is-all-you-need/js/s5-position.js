/* §5 Positional Encoding — 순열 불변성, heatmap, 유사도, 상대 위치 */
Lab.section('s5', function () {
  var $ = Lab.$, M = Lab.M, fmt = Lab.fmt, esc = Lab.esc;

  function pe(pos, i, dm) {
    var k = Math.floor(i / 2), w = 1 / Math.pow(10000, (2 * k) / dm);
    return i % 2 === 0 ? Math.sin(pos * w) : Math.cos(pos * w);
  }
  function peVec(pos, dm) { var v = []; for (var i = 0; i < dm; i++) v.push(pe(pos, i, dm)); return v; }

  /* ---------------- 실험 5-1: 순열 불변성 ---------------- */
  var D = 8;
  var rW = Lab.rng(2024);
  var Wq = Lab.randMat(D, D, rW, 1 / Math.sqrt(D)), Wk = Lab.randMat(D, D, rW, 1 / Math.sqrt(D)), Wv = Lab.randMat(D, D, rW, 1 / Math.sqrt(D));
  function emb(word) { var r = Lab.rng(Lab.hash(word.toLowerCase())); var v = []; for (var i = 0; i < D; i++) v.push(Lab.gauss(r)); return v; }
  function encode(words, usePE) {
    var X = words.map(function (w, p) { return emb(w).map(function (v, i) { return v + (usePE ? pe(p, i, D) : 0); }); });
    return M.attention(M.mul(X, Wq), M.mul(X, Wk), M.mul(X, Wv)).O;
  }
  function split(s) { return s.trim().split(/\s+/).filter(Boolean).slice(0, 12); }
  var usePE = false;
  var aIn = $('#s5-a'), bIn = $('#s5-b');
  Lab.seg($('#s5-pe-seg'), [{ v: 0, label: '끄기' }, { v: 1, label: '켜기' }], 0, function (v) { usePE = v === '1'; draw51(); });
  function vecHtml(v, range) {
    var tmp = document.createElement('div');
    Lab.matrix(tmp, [v], { mode: 'div', range: range, values: false, cls: 'xs' });
    return tmp.innerHTML;
  }
  function draw51() {
    var A = split(aIn.value), B = split(bIn.value);
    if (!A.length || !B.length) { $('#s5-cmp').innerHTML = ''; $('#s5-cmp-read').textContent = '두 문장에 단어를 하나 이상 넣어 주세요.'; return; }
    var OA = encode(A, usePE), OB = encode(B, usePE);
    var mabs = 0;
    OA.concat(OB).forEach(function (r) { r.forEach(function (v) { mabs = Math.max(mabs, Math.abs(v)); }); });
    var range = [-mabs, mabs];
    var used = B.map(function () { return false; });
    var h = '<thead><tr><th>단어</th><th class="num">A 위치</th><th class="num">B 위치</th><th>A에서 출력</th><th>B에서 출력</th><th class="num">코사인</th><th class="num">‖차이‖</th></tr></thead><tbody>';
    var allSame = true, matched = 0;
    A.forEach(function (w, i) {
      var j = B.findIndex(function (x, k) { return !used[k] && x.toLowerCase() === w.toLowerCase(); });
      if (j < 0) { h += '<tr><td>' + esc(w) + '</td><td class="num">' + (i + 1) + '</td><td class="num">—</td><td colspan="4" class="hint">B에 없는 단어</td></tr>'; allSame = false; return; }
      used[j] = true; matched++;
      var c = M.cos(OA[i], OB[j]);
      var diff = Math.sqrt(OA[i].reduce(function (s, v, k) { return s + Math.pow(v - OB[j][k], 2); }, 0));
      if (diff > 1e-9) allSame = false;
      h += '<tr><td><b>' + esc(w) + '</b></td><td class="num">' + (i + 1) + '</td><td class="num">' + (j + 1) + '</td><td>' + vecHtml(OA[i], range) + '</td><td>' + vecHtml(OB[j], range) + '</td>' +
        '<td class="num' + (diff < 1e-9 ? ' best' : '') + '">' + fmt(c, 4) + '</td><td class="num">' + (diff < 1e-9 ? '0' : fmt(diff, 3)) + '</td></tr>';
    });
    $('#s5-cmp').innerHTML = h + '</tbody>';
    var isPerm = A.length === B.length && A.map(function (x) { return x.toLowerCase(); }).sort().join(' ') === B.map(function (x) { return x.toLowerCase(); }).sort().join(' ');
    var mean = function (O) { return O[0].map(function (_, k) { return O.reduce(function (s, r) { return s + r[k]; }, 0) / O.length; }); };
    var msg;
    if (!isPerm) msg = 'B가 A의 단어를 재배열한 문장이 아닙니다. 같은 단어 집합일 때 비교가 의미 있습니다.';
    else if (!usePE) msg = (allSame ? '위치 인코딩 없음 → 같은 단어의 출력이 두 문장에서 완전히 같습니다. ' : '') + '문장 평균 벡터의 코사인 유사도 = ' + fmt(M.cos(mean(OA), mean(OB)), 4) + '. 모델 입장에서 두 문장은 구별되지 않습니다.';
    else msg = '위치 인코딩 켬 → 같은 단어라도 위치가 다르면 출력이 달라집니다. 문장 평균 벡터의 코사인 유사도 = ' + fmt(M.cos(mean(OA), mean(OB)), 4) + '.';
    $('#s5-cmp-read').textContent = msg;
    void matched;
  }
  aIn.addEventListener('input', draw51);
  bIn.addEventListener('input', draw51);
  $('#s5-shuffle').addEventListener('click', function () {
    var A = split(aIn.value), B = A.slice();
    for (var t = 0; t < 10; t++) {
      for (var i = B.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = B[i]; B[i] = B[j]; B[j] = x; }
      if (B.join(' ') !== A.join(' ')) break;
    }
    bIn.value = B.join(' ');
    draw51();
  });
  draw51();

  /* ---------------- 실험 5-2: heatmap ---------------- */
  var LInp = $('#s5-L'), dSel = $('#s5-d'), iInp = $('#s5-i');
  var heat = $('#s5-heat'), sim = $('#s5-sim');
  function L() { return +LInp.value; }
  function dm() { return +dSel.value; }
  function colorFns() {
    var neg = Lab.rgb('--neg'), zero = Lab.rgb('--zero'), pos = Lab.rgb('--pos');
    return function (v) { return v >= 0 ? Lab.mixRGB(zero, pos, Math.min(1, v)) : Lab.mixRGB(zero, neg, Math.min(1, -v)); };
  }
  function paint(canvas, w, h, fn) {
    var off = document.createElement('canvas');
    off.width = w; off.height = h;
    var ctx = off.getContext('2d'), img = ctx.createImageData(w, h), col = colorFns();
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var c = col(fn(x, y)), o = (y * w + x) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    var dpr = window.devicePixelRatio || 1;
    var cw = canvas.clientWidth || 300, ch = canvas.clientHeight || 280;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    var g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(off, 0, 0, canvas.width, canvas.height);
  }
  function drawHeat() {
    var l = L(), d = dm();
    $('#s5-L-out').textContent = l;
    paint(heat, d, l, function (x, y) { return pe(y, x, d); });
  }
  heat.addEventListener('mousemove', function (e) {
    var r = heat.getBoundingClientRect(), d = dm(), l = L();
    var i = Math.floor((e.clientX - r.left) / r.width * d), p = Math.floor((e.clientY - r.top) / r.height * l);
    if (i < 0 || i >= d || p < 0 || p >= l) return;
    var k = Math.floor(i / 2), lambda = 2 * Math.PI * Math.pow(10000, 2 * k / d);
    $('#s5-heat-read').textContent = '위치 pos = ' + p + ', 차원 ' + i + ' (쌍 i = ' + k + ', ' + (i % 2 ? 'cos' : 'sin') + ')  값 = ' + fmt(pe(p, i, d), 3) +
      '\n이 차원의 파장 = 2π·10000^(' + (2 * k) + '/' + d + ') ≈ ' + (lambda < 1000 ? fmt(lambda, 1) : Lab.compact(lambda)) + ' 위치' + (lambda > l * 4 ? ' (보이는 범위보다 훨씬 길어 거의 변하지 않음)' : '');
  });

  var wave = new Lab.Chart($('#s5-wave'), {
    height: 200, x: { label: '위치 pos', name: 'pos', fmt: function (v) { return String(Math.round(v)); } },
    y: { domain: [-1.1, 1.1], ticks: [-1, -0.5, 0, 0.5, 1], fmt: function (v) { return fmt(v, 1); } }, series: []
  });
  function drawWave() {
    var d = dm(), l = L();
    iInp.max = d / 2 - 1;
    if (+iInp.value > d / 2 - 1) iInp.value = d / 2 - 1;
    var i = +iInp.value;
    var w = 1 / Math.pow(10000, 2 * i / d), lambda = 2 * Math.PI / w;
    $('#s5-i-out').textContent = i + ' (차원 ' + (2 * i) + ', ' + (2 * i + 1) + ')';
    var sinD = [], cosD = [], pts = [];
    for (var t = 0; t <= 400; t++) { var p = t * (l - 1) / 400; sinD.push([p, Math.sin(p * w)]); cosD.push([p, Math.cos(p * w)]); }
    for (var q = 0; q < l; q++) pts.push([q, Math.sin(q * w)]);
    wave.set({
      title: '파장 ≈ ' + (lambda < 1e4 ? fmt(lambda, 1) : Lab.compact(lambda)) + ' 위치',
      x: { domain: [0, l - 1], label: '위치 pos', name: 'pos', fmt: function (v) { return String(Math.round(v)); }, tipFmt: function (v) { return fmt(v, 1); } },
      series: [
        { name: 'sin · 차원 ' + (2 * i), color: 'var(--c1)', data: sinD },
        { name: 'cos · 차원 ' + (2 * i + 1), color: 'var(--c2)', data: cosD, dash: '5 4' }
      ]
    });
    void pts;
  }

  /* ---------------- 실험 5-3: 유사도 ---------------- */
  var p0Inp = $('#s5-p0'), kInp = $('#s5-k');
  function simDelta(delta, d) {
    var s = 0;
    for (var k = 0; k < d / 2; k++) s += Math.cos(delta / Math.pow(10000, 2 * k / d));
    return s / (d / 2);
  }
  function drawSimMap() {
    var l = L(), d = dm(), f = [];
    for (var t = 0; t < l; t++) f.push(simDelta(t, d));
    paint(sim, l, l, function (x, y) { return f[Math.abs(x - y)]; });
  }
  var simLine = new Lab.Chart($('#s5-simline'), {
    height: 210, title: 'PE(p)와 다른 위치의 코사인 유사도',
    x: { label: '위치', name: '위치', fmt: function (v) { return String(Math.round(v)); } },
    y: { domain: [-0.3, 1.05], fmt: function (v) { return fmt(v, 1); } }, series: []
  });
  var relChart = new Lab.Chart($('#s5-rel'), {
    height: 200, x: { label: '시작 위치 p', name: 'p', fmt: function (v) { return String(Math.round(v)); } },
    y: { domain: [-1.05, 1.05], ticks: [-1, -0.5, 0, 0.5, 1], fmt: function (v) { return fmt(v, 1); } }, series: []
  });
  var rnd = (function () {
    var r = Lab.rng(99), out = [];
    for (var p = 0; p < 260; p++) {
      var v = []; for (var i = 0; i < 512; i++) v.push(Lab.gauss(r));
      out.push(v);
    }
    return out;
  })();
  function drawSimLines() {
    var l = L(), d = dm();
    p0Inp.max = l - 1;
    if (+p0Inp.value > l - 1) p0Inp.value = l - 1;
    var p0 = +p0Inp.value, k = +kInp.value;
    $('#s5-p0-out').textContent = p0;
    $('#s5-k-out').textContent = k;
    var data = [];
    for (var p = 0; p < l; p++) data.push([p, simDelta(Math.abs(p - p0), d)]);
    simLine.set({
      x: { domain: [0, l - 1], label: '위치', name: '위치', fmt: function (v) { return String(Math.round(v)); } },
      series: [{ name: 'p = ' + p0 + ' 기준', color: 'var(--c1)', data: data, area: true }],
      vlines: [{ x: p0, label: 'p = ' + p0 }]
    });
    var sinData = [], rndData = [];
    for (var s = 0; s + k < l; s++) {
      sinData.push([s, M.dot(peVec(s, d), peVec(s + k, d)) / (d / 2)]);
      var a = rnd[s].slice(0, d), b = rnd[s + k].slice(0, d);
      rndData.push([s, M.cos(a, b)]);
    }
    relChart.set({
      title: 'k = ' + k + ' 떨어진 두 위치의 유사도',
      x: { domain: [0, Math.max(1, l - 1 - k)], label: '시작 위치 p', name: 'p', fmt: function (v) { return String(Math.round(v)); } },
      series: [
        { name: '사인파 PE: 모든 p에서 같은 값', color: 'var(--c1)', data: sinData, width: 2.5 },
        { name: '무작위 위치 벡터 (비교용)', color: 'var(--c6)', data: rndData, width: 1.3, opacity: 0.8 }
      ]
    });
  }

  function redrawAll() { drawHeat(); drawWave(); drawSimMap(); drawSimLines(); }
  LInp.addEventListener('input', redrawAll);
  dSel.addEventListener('change', redrawAll);
  iInp.addEventListener('input', drawWave);
  p0Inp.addEventListener('input', drawSimLines);
  kInp.addEventListener('input', drawSimLines);
  Lab.onTheme(function () { drawHeat(); drawSimMap(); });
  if (window.ResizeObserver) {
    var lw = 0;
    new ResizeObserver(function () { if (heat.clientWidth !== lw) { lw = heat.clientWidth; drawHeat(); drawSimMap(); } }).observe(heat);
  }
  redrawAll();
});
