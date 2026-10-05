/* §1 왜 RNN을 버렸나 — 경로 길이 그림, Table 1 계산기 */
Lab.section('s1', function () {
  var $ = Lab.$, esc = Lab.esc;

  /* ---------------- 실험 1-1: 순차 계산과 경로 길이 ---------------- */
  var words = ['The', 'animal', "didn't", 'cross', 'the', 'street', 'because', 'it', 'was', 'too', 'tired', '.'];
  var n = words.length, W = 720, col = W / n;
  var from = 1, to = 7, pickNext = 0;
  var tick = -1, timer = null;
  var rnnSvg = $('#s1-rnn'), attSvg = $('#s1-att');
  function cx(i) { return col * (i + 0.5); }

  var defs = '<defs><marker id="s1-ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="arrowhead"/></marker>' +
    '<marker id="s1-ah-on" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" style="fill:var(--amber)"/></marker></defs>';

  function tokens(y) {
    var s = '';
    for (var i = 0; i < n; i++) {
      var sel = i === from || i === to;
      s += '<g class="tok-hit' + (sel ? ' tok-sel' : '') + '" data-i="' + i + '" tabindex="0" role="button" aria-label="' + esc(words[i]) + ' 선택">' +
        '<rect x="' + (cx(i) - col / 2 + 2) + '" y="' + (y - 14) + '" width="' + (col - 4) + '" height="24" fill="transparent"/>' +
        '<text x="' + cx(i) + '" y="' + (y + 3) + '" text-anchor="middle">' + esc(words[i]) + '</text></g>';
    }
    return s;
  }

  function drawRNN() {
    var yH = 52, yT = 128, bw = 34, bh = 28;
    var s = defs;
    for (var i = 0; i < n - 1; i++) {
      var on = i >= from && i < to;
      s += '<line x1="' + (cx(i) + bw / 2) + '" y1="' + yH + '" x2="' + (cx(i + 1) - bw / 2 - 1) + '" y2="' + yH + '" class="' + (on ? 'ln-on' : 'ln') + '" marker-end="url(#' + (on ? 's1-ah-on' : 's1-ah') + ')"/>';
    }
    for (i = 0; i < n; i++) {
      var onv = i === from;
      s += '<line x1="' + cx(i) + '" y1="' + (yT - 16) + '" x2="' + cx(i) + '" y2="' + (yH + bh / 2 + 1) + '" class="' + (onv ? 'ln-on' : 'ln') + '" marker-end="url(#' + (onv ? 's1-ah-on' : 's1-ah') + ')"/>';
    }
    for (i = 0; i < n; i++) {
      var cls = (i >= from && i <= to) ? 'box-path' : (tick >= i ? 'box-lit' : 'box');
      if (tick >= 0 && tick >= i && !(i >= from && i <= to)) cls = 'box-lit';
      s += '<rect x="' + (cx(i) - bw / 2) + '" y="' + (yH - bh / 2) + '" width="' + bw + '" height="' + bh + '" rx="5" class="' + cls + '"/>';
      s += '<text x="' + cx(i) + '" y="' + (yH + 4) + '" text-anchor="middle" class="t-mono">h' + (i + 1) + '</text>';
      if (tick === i) s += '<circle cx="' + cx(i) + '" cy="' + (yH - bh / 2 - 8) + '" r="3.5" style="fill:var(--accent)"/>';
    }
    s += tokens(yT);
    rnnSvg.innerHTML = s;
  }

  function drawAtt() {
    var yH = 40, yT = 128, bw = 34, bh = 26;
    var s = defs;
    for (var i = 0; i < n; i++) {
      for (var j = 0; j < n; j++) {
        if (i === from && j === to) continue;
        s += '<line x1="' + cx(i) + '" y1="' + (yT - 16) + '" x2="' + cx(j) + '" y2="' + (yH + bh / 2) + '" class="ln-faint"/>';
      }
    }
    s += '<line x1="' + cx(from) + '" y1="' + (yT - 16) + '" x2="' + cx(to) + '" y2="' + (yH + bh / 2 + 1) + '" class="ln-on" marker-end="url(#s1-ah-on)"/>';
    for (i = 0; i < n; i++) {
      var cls = i === to ? 'box-path' : (tick >= 0 ? 'box-lit' : 'box');
      s += '<rect x="' + (cx(i) - bw / 2) + '" y="' + (yH - bh / 2) + '" width="' + bw + '" height="' + bh + '" rx="5" class="' + cls + '"/>';
      s += '<text x="' + cx(i) + '" y="' + (yH + 4) + '" text-anchor="middle" class="t-mono">z' + (i + 1) + '</text>';
    }
    s += tokens(yT);
    attSvg.innerHTML = s;
  }

  function readouts() {
    var hops = to - from;
    $('#s1-rnn-read').textContent = '"' + words[from] + '" → "' + words[to] + '": 정보가 h' + (from + 1) + '에서 h' + (to + 1) + '까지 은닉 상태를 ' + hops + '번 건너야 합니다 (경로 길이 ' + hops + ', 최악 O(n)).';
    $('#s1-att-read').textContent = '"' + words[from] + '" → "' + words[to] + '": 한 번에 직접 연결됩니다 (경로 길이 1, 거리와 무관 O(1)).';
  }
  function draw() { drawRNN(); drawAtt(); readouts(); }

  function pick(i) {
    if (pickNext === 0) { from = i; pickNext = 1; if (to === from) to = Math.min(n - 1, from + 1); }
    else { to = i; pickNext = 0; }
    if (from === to) { to = Math.min(n - 1, from + 1); if (to === from) from = to - 1; }
    if (from > to) { var t = from; from = to; to = t; }
    draw();
  }
  [rnnSvg, attSvg].forEach(function (svg) {
    svg.addEventListener('click', function (e) {
      var g = e.target.closest('[data-i]');
      if (g) pick(+g.dataset.i);
    });
    svg.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var g = e.target.closest('[data-i]');
      if (g) { e.preventDefault(); pick(+g.dataset.i); }
    });
  });

  var tickEl = $('#s1-tick'), playBtn = $('#s1-play');
  playBtn.addEventListener('click', function () {
    if (timer) { clearInterval(timer); timer = null; }
    tick = 0;
    draw();
    tickEl.textContent = 'RNN 1 / ' + n + ' 단계 · Self-attention 1 / 1 단계 (모든 위치 동시에 완료)';
    timer = setInterval(function () {
      tick++;
      if (tick >= n) {
        clearInterval(timer); timer = null;
        tickEl.textContent = 'RNN은 ' + n + '단계, self-attention은 1단계에 끝났습니다.';
        return;
      }
      tickEl.textContent = 'RNN ' + (tick + 1) + ' / ' + n + ' 단계 · Self-attention은 이미 완료';
      drawRNN();
    }, 420);
  });
  draw();

  /* ---------------- 실험 1-2: Table 1 계산기 ---------------- */
  var nInp = $('#s1-n'), dSel = $('#s1-d'), kInp = $('#s1-k'), rInp = $('#s1-r');
  function nVal() { return Math.round(Math.pow(2, 3 + (+nInp.value) * 11 / 100)); }
  function rVal() { return Math.pow(2, +rInp.value); }
  var rows = [
    { name: 'Self-Attention', f: ['n²·d', '1', '1'], color: 'var(--c1)', calc: function (n, d) { return [n * n * d, 1, 1]; } },
    { name: 'Recurrent', f: ['n·d²', 'n', 'n'], color: 'var(--c2)', calc: function (n, d) { return [n * d * d, n, n]; } },
    { name: 'Convolutional', f: ['k·n·d²', '1', 'logₖ n'], color: 'var(--c3)', calc: function (n, d, k) { return [k * n * d * d, 1, Math.max(1, Math.ceil(Math.log(n) / Math.log(k) - 1e-9))]; } },
    { name: 'Self-Attention (restricted)', f: ['r·n·d', '1', 'n/r'], color: 'var(--c4)', calc: function (n, d, k, r) { r = Math.min(r, n); return [r * n * d, 1, Math.max(1, Math.ceil(n / r))]; } }
  ];
  var chart = new Lab.Chart($('#s1-chart'), {
    height: 260,
    title: '층당 연산량 (곱셈 수) vs 시퀀스 길이',
    x: { type: 'log', domain: [8, 16384], label: '시퀀스 길이 n', name: 'n' },
    y: { type: 'log', label: '연산량' },
    series: []
  });

  function update() {
    var n = nVal(), d = +dSel.value, k = +kInp.value, r = rVal();
    $('#s1-n-out').textContent = Lab.int(n);
    $('#s1-k-out').textContent = k;
    $('#s1-r-out').textContent = r;
    var vals = rows.map(function (row) { return row.calc(n, d, k, r); });
    var best = [0, 1, 2].map(function (c) { return Math.min.apply(null, vals.map(function (v) { return v[c]; })); });
    var h = '<thead><tr><th>층 종류</th><th class="num">층당 연산량</th><th class="num">순차 연산 수</th><th class="num">최대 경로 길이</th></tr></thead><tbody>';
    rows.forEach(function (row, i) {
      h += '<tr><td><span class="swatch" style="background:' + row.color + '"></span>' + row.name + '</td>';
      for (var c = 0; c < 3; c++) {
        h += '<td class="num' + (vals[i][c] === best[c] ? ' best' : '') + '"><span class="f">O(' + row.f[c] + ')</span><br>' + (c === 0 ? Lab.compact(vals[i][c]) : Lab.int(vals[i][c])) + '</td>';
      }
      h += '</tr>';
    });
    $('#s1-table').innerHTML = h + '</tbody>';

    var ns = Lab.logspace(8, 16384, 60);
    chart.set({
      series: rows.map(function (row) {
        return { name: row.name.replace(' (restricted)', ' (r)'), color: row.color, dash: row.name.indexOf('restricted') > 0 ? '5 4' : (row.name === 'Convolutional' ? '2 3' : null), data: ns.map(function (x) { return [x, row.calc(x, d, k, r)[0]]; }) };
      }),
      vlines: [{ x: n, label: 'n = ' + Lab.int(n) }],
      points: [{ x: d, y: d * d * d, label: 'n = d', color: 'var(--ink-2)' }]
    });
    var ratio = (n * n * d) / (n * d * d);
    $('#s1-verdict').textContent = ratio < 1
      ? 'n = ' + Lab.int(n) + ' < d = ' + d + ' → self-attention이 RNN보다 ' + Lab.fmt(1 / ratio, 1) + '배 적은 연산. 게다가 순차 연산은 1번뿐입니다.'
      : 'n = ' + Lab.int(n) + ' ≥ d = ' + d + ' → self-attention이 RNN보다 ' + Lab.fmt(ratio, 1) + '배 많은 연산. 그래도 순차 연산 1번, 경로 길이 1이라는 장점은 그대로입니다.';
  }
  [nInp, kInp, rInp].forEach(function (el) { el.addEventListener('input', update); });
  dSel.addEventListener('change', update);
  update();
});
