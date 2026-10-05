/* §2 Scaled Dot-Product Attention — 단계별 계산기, 스케일링 실험 */
Lab.section('s2', function () {
  var $ = Lab.$, $$ = Lab.$$, M = Lab.M, fmt = Lab.fmt;

  /* ---------------- 실험 2-1: 단계별 계산기 ---------------- */
  var toks = ['나는', '커피를', '정말', '좋아해'];
  var dims = ['1', '2', '3', '4'];
  var PRESETS = {
    base: {
      Q: [[1, 0, 1, 0], [0, 2, 0, 1], [1, 1, 0, 0], [0, 1, 1, 1]],
      K: [[1, 0, 1, 0], [0, 1, 0, 1], [1, 0, 0, 0], [0, 2, 1, 0]],
      V: [[1, 0, 0, 2], [0, 1, 0, 0], [2, 0, 1, 0], [0, 0, 1, 1]]
    }
  };
  var PRESET_NOTES = {
    base: '기본 예시입니다. 먼저 따라갈 단어 하나의 행이 ① → ④ → ⑤로 어떻게 바뀌는지 보세요.',
    sharp: 'Q를 3배로 키웠습니다. 점수 차이가 커져서 ④ 가중치가 한 칸에 더 몰립니다. 누를 때마다 3배씩 더 커집니다.',
    same: '모든 단어의 Key를 똑같이 만들었습니다. 행 안의 점수가 모두 같아져 ④ 가중치가 0.25로 고르게 퍼지고, ⑤ 출력은 V 네 행의 단순 평균이 됩니다. Key로 단어를 구별할 수 없으면 어디를 볼지 정하지 못합니다.',
    ident: 'V를 단위행렬로 바꿨습니다. 각 단어의 Value가 "자기 번호 칸만 1"이 되어 ⑤ 출력이 ④ 가중치와 똑같아집니다. 출력은 가중치대로 Value를 섞은 것일 뿐이라는 뜻입니다.',
    rand: 'Q·K·V를 무작위로 뽑았습니다. 값이 무엇이든 ④의 각 행은 합이 1이고, ⑤ 출력은 V 행들의 가중 평균입니다.'
  };
  var Q, K, V;
  var focus = 1; // 따라갈 단어(행). null이면 전체
  function clone(A) { return A.map(function (r) { return r.slice(); }); }
  function load(name) {
    $('#s2-preset-note').textContent = PRESET_NOTES[name];
    var b = PRESETS.base;
    if (name === 'base') { Q = clone(b.Q); K = clone(b.K); V = clone(b.V); }
    else if (name === 'sharp') { Q = M.scale(Q, 3); }
    else if (name === 'same') { K = [0, 1, 2, 3].map(function () { return [1, 1, 0, 0]; }); }
    else if (name === 'ident') { V = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]; }
    else if (name === 'rand') {
      var r = Lab.rng(Date.now() & 0xffff);
      var ri = function () { return Math.round((r() * 4 - 2) * 2) / 2; };
      Q = [0, 1, 2, 3].map(function () { return [ri(), ri(), ri(), ri()]; });
      K = [0, 1, 2, 3].map(function () { return [ri(), ri(), ri(), ri()]; });
      V = [0, 1, 2, 3].map(function () { return [ri(), ri(), ri(), ri()]; });
    }
    editors();
    compute();
  }
  function editors() {
    Lab.matrixInput($('#s2-Q'), Q, { rows: toks, cols: dims, name: 'Q', onChange: compute });
    Lab.matrixInput($('#s2-K'), K, { rows: toks, cols: dims, name: 'K', onChange: compute });
    Lab.matrixInput($('#s2-V'), V, { rows: toks, cols: dims, name: 'V', onChange: compute });
    markRows($('#s2-Q'), '.mx-inp');
  }

  /* 따라갈 단어의 행만 밝게: 행 라벨과 칸(sel)에 dimc/on 표시 */
  function markRows(el, sel) {
    $$('.mx-rl', el).forEach(function (r, i) {
      r.classList.toggle('on', i === focus);
      r.classList.toggle('dimc', focus !== null && i !== focus);
    });
    if (sel) $$(sel, el).forEach(function (c) { c.classList.toggle('dimc', focus !== null && +c.dataset.i !== focus); });
  }
  function rowMark(i) { return focus !== null && i !== focus ? 'dimc' : ''; }

  var scaleCb = $('#s2-scale'), maskCb = $('#s2-mask');
  var R = null;
  var read = $('#s2-read');
  function causal(i, j) { return j > i; }

  function compute() {
    var useScale = scaleCb.checked, useMask = maskCb.checked;
    R = M.attention(Q, K, V, { scale: useScale, mask: useMask ? causal : null });
    var common = { rows: toks, cols: toks, cw: '2.7rem', mark: rowMark };
    Lab.matrix($('#s2-S'), R.S, Object.assign({}, common, { mode: 'div', onHover: hover('S') }));
    Lab.matrix($('#s2-Ss'), R.Ss, Object.assign({}, common, { mode: 'div', onHover: hover('Ss') }));
    Lab.matrix($('#s2-Sm'), R.Sm, Object.assign({}, common, { mode: 'div', onHover: hover('Sm') }));
    Lab.matrix($('#s2-A'), R.A, Object.assign({}, common, { range: [0, 1], onHover: hover('A') }));
    Lab.matrix($('#s2-O'), R.O, { rows: toks, cols: dims, mode: 'div', cw: '2.7rem', mark: rowMark, onHover: hover('O') });
    ['#s2-S', '#s2-Ss', '#s2-Sm', '#s2-A', '#s2-O'].forEach(function (s) { markRows($(s)); });
    $('#s2-panels [data-step="2"] .panel-title').innerHTML = useScale ? '② S / √d<sub>k</sub> (= ÷ 2)' : '② 스케일링 꺼짐 (S 그대로)';
    $('#s2-panels [data-step="3"] .panel-title').innerHTML = useMask ? '③ + causal mask' : '③ mask 없음 (그대로)';
    summary();
  }

  /* 따라갈 단어 한 행의 흐름 요약 (마우스를 올리지 않았을 때 계산 내역 칸에 표시) */
  function summary() {
    if (focus === null) { read.textContent = '결과 칸에 마우스를 올리거나 누르면 그 값의 계산 과정을 보여 줍니다.'; return; }
    var i = focus;
    var row = function (a) { return a.map(function (v) { return v === -Infinity ? '−∞' : fmt(v, 2); }).join(', '); };
    var best = R.A[i].indexOf(Math.max.apply(null, R.A[i]));
    var t = '"' + toks[i] + '" 행 따라가기 (열: ' + toks.join(', ') + ')\n' +
      '① 점수 = ' + row(R.S[i]) + '\n';
    if (scaleCb.checked) t += '② ÷ 2 = ' + row(R.Ss[i]) + '\n';
    if (maskCb.checked) t += '③ 미래 칸 가림 = ' + row(R.Sm[i]) + '\n';
    t += '④ 가중치 = ' + row(R.A[i]) + '  → 가장 많이 보는 단어: ' + toks[best] + '\n' +
      '⑤ 출력 = ' + R.A[i].map(function (a, k) { return fmt(a, 2) + '·v(' + toks[k] + ')'; }).join(' + ') + ' = [' + row(R.O[i]) + ']';
    read.textContent = t;
  }

  function hover(which) {
    return function (i, j) {
      if (i === null) { summary(); return; }
      var sc = scaleCb.checked ? 2 : 1;
      var t = '';
      if (which === 'S') {
        t = 'S[' + toks[i] + ', ' + toks[j] + '] = q(' + toks[i] + ') · k(' + toks[j] + ')\n= ' +
          Q[i].map(function (q, c) { return '(' + fmt(q, 1) + '×' + fmt(K[j][c], 1) + ')'; }).join(' + ') + '\n= ' + fmt(R.S[i][j], 2);
      } else if (which === 'Ss') {
        t = fmt(R.S[i][j], 2) + (sc === 2 ? ' ÷ √4 = ' : ' (나누지 않음) = ') + fmt(R.Ss[i][j], 2) +
          '\n점수의 크기를 d_k에 상관없이 비슷하게 유지합니다.';
      } else if (which === 'Sm') {
        t = R.Sm[i][j] === -Infinity
          ? '열 ' + toks[j] + '(' + (j + 1) + '번째)은 행 ' + toks[i] + '(' + (i + 1) + '번째)보다 뒤 → 미래 위치라 −∞\nexp(−∞) = 0 이므로 softmax 후 가중치 0'
          : '가려지지 않은 칸: ' + fmt(R.Sm[i][j], 2) + ' 그대로';
      } else if (which === 'A') {
        var row = R.Sm[i];
        var mx = Math.max.apply(null, row.filter(isFinite));
        var terms = row.map(function (v) { return v === -Infinity ? '0' : 'e^' + fmt(v, 2); });
        var den = row.reduce(function (s, v) { return s + (v === -Infinity ? 0 : Math.exp(v - mx)); }, 0);
        t = 'A[' + toks[i] + ', ' + toks[j] + '] = exp(' + fmt(row[j], 2) + ') / Σ exp(행 ' + toks[i] + ')\n= ' +
          (row[j] === -Infinity ? '0' : 'e^' + fmt(row[j], 2)) + ' / (' + terms.join(' + ') + ')\n= ' + fmt(R.A[i][j], 3) +
          '   (행 합계 ' + fmt(R.A[i].reduce(function (a, b) { return a + b; }, 0), 3) + ')';
        void den;
      } else if (which === 'O') {
        t = '출력[' + toks[i] + ', ' + (j + 1) + '] = Σ_j A[' + toks[i] + ', j] · V[j, ' + (j + 1) + ']\n= ' +
          R.A[i].map(function (a, k) { return fmt(a, 2) + '×' + fmt(V[k][j], 1); }).join(' + ') + '\n= ' + fmt(R.O[i][j], 3);
      }
      read.textContent = t;
    };
  }

  /* 단계 안내 */
  var NOTES = [
    '다섯 단계를 한꺼번에 보는 중입니다. 따라갈 단어의 행이 ① 점수 → ④ 가중치 → ⑤ 출력으로 이어집니다. 단계를 하나 고르면 그 단계만 강조합니다.',
    '① Query 행과 Key 행의 내적. 그림의 "점수 q·k"에 해당합니다. s<sub>ij</sub>가 클수록 i번째 단어가 j번째 단어를 "관련 있다"고 봅니다. (4 × d<sub>k</sub>)·(d<sub>k</sub> × 4) = 4 × 4.',
    '② √d<sub>k</sub> = 2로 나눕니다. d<sub>k</sub>가 커질수록 내적의 분산이 커지는 것을 상쇄해 softmax가 한쪽으로 쏠리지 않게 합니다. 이유는 실험 2-2에서 확인합니다.',
    '③ 보면 안 되는 위치를 −∞로 바꿉니다. 위의 "causal mask"를 켜면 j &gt; i인 칸(미래)이 가려집니다. 자세한 건 §3에서.',
    '④ 행마다 softmax. 그림의 "가중치" 막대에 해당합니다. 각 행의 합이 1인 분포가 되어 "어디를 얼마나 볼지"를 나타냅니다. 가려진 칸은 정확히 0입니다.',
    '⑤ 가중치로 Value 행을 섞습니다. 그림의 "출력"에 해당합니다. 출력 i행 = Σ<sub>j</sub> A<sub>ij</sub> · v<sub>j</sub>. V를 단위행렬로 바꾸면 출력이 A와 똑같아집니다.'
  ];
  var stepEl = $('#s2-steps');
  var labels = ['전체', '① QKᵀ', '② ÷√d_k', '③ mask', '④ softmax', '⑤ ×V'];
  stepEl.innerHTML = labels.map(function (l, i) { return '<button type="button" data-s="' + i + '" aria-pressed="' + (i === 0) + '">' + l + '</button>'; }).join('');
  function setStep(s) {
    $$('button', stepEl).forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.s === s)); });
    $$('#s2-panels .panel[data-step]').forEach(function (p) {
      var k = +p.dataset.step;
      p.classList.toggle('dim', s > 0 && k !== s);
      p.classList.toggle('focus', s > 0 && k === s);
    });
    $('#s2-note').innerHTML = NOTES[s];
  }
  stepEl.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setStep(+b.dataset.s); });
  $('#s2-presets').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (b) load(b.dataset.p); });
  scaleCb.addEventListener('change', compute);
  maskCb.addEventListener('change', compute);
  Lab.seg($('#s2-focus'), toks.map(function (t, i) { return { v: i, label: t }; }).concat([{ v: 'all', label: '전체' }]), focus, function (v) {
    focus = v === 'all' ? null : +v;
    markRows($('#s2-Q'), '.mx-inp');
    compute();
  });
  load('base');
  setStep(0);

  /* ---------------- 실험 2-2: 스케일링과 포화 ---------------- */
  var NK = 8;
  var dkInp = $('#s2-dk');
  var seed = 11;
  function dkVal() { return Math.pow(2, +dkInp.value); }
  function scores(dk, sd) {
    var r = Lab.rng(sd * 7919 + dk);
    var q = [], i, j;
    for (i = 0; i < dk; i++) q.push(Lab.gauss(r));
    var s = [];
    for (j = 0; j < NK; j++) {
      var acc = 0;
      for (i = 0; i < dk; i++) acc += q[i] * Lab.gauss(r);
      s.push(acc);
    }
    return s;
  }
  function stat(sc) {
    var p = M.softmax(sc), n = p.length;
    var mx = Math.max.apply(null, p);
    var H = 0, J = 0, i, k;
    for (i = 0; i < n; i++) if (p[i] > 0) H -= p[i] * Math.log2(p[i]);
    for (i = 0; i < n; i++) for (k = 0; k < n; k++) { var v = (i === k ? p[i] : 0) - p[i] * p[k]; J += v * v; }
    var mean = sc.reduce(function (a, b) { return a + b; }, 0) / n;
    var sd = Math.sqrt(sc.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / n);
    return { p: p, max: mx, H: H, J: Math.sqrt(J), sd: sd };
  }
  function statsHtml(st, warnSat) {
    return '<div class="stat"><b>' + fmt(st.sd, 1) + '</b>점수 표준편차</div>' +
      '<div class="stat' + (warnSat && st.max > 0.95 ? ' warn' : '') + '"><b>' + fmt(st.max, 3) + '</b>최대 가중치</div>' +
      '<div class="stat"><b>' + fmt(st.H, 2) + '</b>엔트로피 (bit, 최대 3)</div>' +
      '<div class="stat' + (st.J < 0.02 ? ' warn' : '') + '"><b>' + (st.J < 0.001 ? st.J.toExponential(1).replace('e-', 'e−') : fmt(st.J, 3)) + '</b>기울기 크기</div>';
  }
  function drawSample() {
    var dk = dkVal();
    $('#s2-dk-out').textContent = dk;
    var sc = scores(dk, seed);
    var raw = stat(sc), scl = stat(sc.map(function (v) { return v / Math.sqrt(dk); }));
    var lab = function (st) {
      var mi = st.p.indexOf(st.max);
      return st.p.map(function (v, i) { return { label: 'k' + (i + 1), value: v, cls: i === mi ? 'max' : '' }; });
    };
    Lab.bars($('#s2-bars-raw'), lab(raw), { max: 1, digits: 2 });
    Lab.bars($('#s2-bars-sc'), lab(scl), { max: 1, digits: 2 });
    $('#s2-st-raw').innerHTML = statsHtml(raw, true);
    $('#s2-st-sc').innerHTML = statsHtml(scl, true);
    if (mcMax) {
      mcMax.set({ vlines: [{ x: dk, label: 'd_k = ' + dk }] });
      mcGrad.set({ vlines: [{ x: dk, label: 'd_k = ' + dk }] });
    }
  }
  dkInp.addEventListener('input', drawSample);
  $('#s2-resample').addEventListener('click', function () { seed++; drawSample(); });

  /* 몬테카를로 곡선 */
  var mcMax = null, mcGrad = null;
  var dks = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
  function monteCarlo() {
    var res = { maxRaw: [], maxSc: [], jRaw: [], jSc: [] };
    dks.forEach(function (dk) {
      var a = 0, b = 0, c = 0, d = 0, N = 300;
      for (var t = 0; t < N; t++) {
        var sc = scores(dk, 1000 + t);
        var s1 = stat(sc), s2 = stat(sc.map(function (v) { return v / Math.sqrt(dk); }));
        a += s1.max; b += s2.max; c += s1.J; d += s2.J;
      }
      res.maxRaw.push([dk, a / N]); res.maxSc.push([dk, b / N]);
      res.jRaw.push([dk, Math.max(c / N, 1e-6)]); res.jSc.push([dk, d / N]);
    });
    return res;
  }
  mcMax = new Lab.Chart($('#s2-mc-max'), {
    height: 210, title: '평균 최대 가중치',
    x: { type: 'log2', domain: [1, 1024], label: 'd_k', name: 'd_k' },
    y: { domain: [0, 1.02], ticks: [0, 0.25, 0.5, 0.75, 1], fmt: function (v) { return Lab.fmt(v, 2); } },
    series: []
  });
  mcGrad = new Lab.Chart($('#s2-mc-grad'), {
    height: 210, title: '평균 기울기 크기 ‖J‖',
    x: { type: 'log2', domain: [1, 1024], label: 'd_k', name: 'd_k' },
    y: { type: 'log', domain: [1e-4, 1], fmt: Lab.compact },
    series: []
  });
  drawSample();
  setTimeout(function () {
    var mc = monteCarlo();
    mcMax.set({ series: [
      { name: '스케일링 없음', color: 'var(--c2)', data: mc.maxRaw },
      { name: '÷√d_k', color: 'var(--c1)', data: mc.maxSc }
    ] });
    mcGrad.set({ series: [
      { name: '스케일링 없음', color: 'var(--c2)', data: mc.jRaw },
      { name: '÷√d_k', color: 'var(--c1)', data: mc.jSc }
    ] });
  }, 60);
});
