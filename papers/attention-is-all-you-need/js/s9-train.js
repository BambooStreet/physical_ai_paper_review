/* §9 직접 학습시켜 보기 — tiny-transformer.js(순수 JS)로 만든 작은 encoder–decoder Transformer
   과제: 길이 L 글자열(A–J)의 뒤집기·복사·정렬 */
Lab.section('s9', function () {
  var $ = Lab.$, fmt = Lab.fmt;
  var TT = window.TinyTF;

  var LETTERS = 'ABCDEFGHIJ'.split('');
  var PAD = 0, BOS = 1, EOS = 2, OFF = 3, V = 13, MAXLEN = 12, BATCH = 32, EVAL_N = 64, EVAL_EVERY = 100;
  function tokStr(t) { return t === BOS ? '‹s›' : t === EOS ? '‹/s›' : t === PAD ? '·' : LETTERS[t - OFF]; }
  var TASKS = {
    copy: function (x) { return x.slice(); },
    reverse: function (x) { return x.slice().reverse(); },
    sort: function (x) { return x.slice().sort(function (a, b) { return a - b; }); }
  };
  var TASK_NAME = { copy: '복사', reverse: '뒤집기', sort: '정렬' };
  var PROBE_BASE = 'DAHBGEJCIF';

  var statusEl = $('#s9-status'), runBtn = $('#s9-run');
  function setStatus(t) { statusEl.textContent = t; }

  /* ---------- 데이터 ---------- */
  function makeData(n, L, task, rng) {
    var src = new Int32Array(n * L), tin = new Int32Array(n * (L + 1)), tout = new Int32Array(n * (L + 1));
    for (var b = 0; b < n; b++) {
      var x = [];
      for (var i = 0; i < L; i++) x.push(OFF + Math.floor(rng() * 10));
      var y = TASKS[task](x);
      src.set(x, b * L);
      tin[b * (L + 1)] = BOS;
      for (i = 0; i < L; i++) { tin[b * (L + 1) + i + 1] = y[i]; tout[b * (L + 1) + i] = y[i]; }
      tout[b * (L + 1) + L] = EOS;
    }
    return { src: src, tin: tin, tout: tout, B: n, L: L };
  }
  function parseLetters(s) {
    var out = [];
    String(s).toUpperCase().split('').forEach(function (ch) { var i = LETTERS.indexOf(ch); if (i >= 0) out.push(OFF + i); });
    return out;
  }

  /* ---------- 설정 ---------- */
  var CFG_IDS = ['task', 'L', 'N', 'h', 'd', 'pe', 'scale', 'ls', 'warm', 'lr'];
  function readCfg() {
    var d = +$('#s9-d').value;
    return {
      task: $('#s9-task').value, L: +$('#s9-L').value, N: +$('#s9-N').value, h: +$('#s9-h').value, d: d, dff: 4 * d,
      pe: $('#s9-pe').value, scale: $('#s9-scale').value === '1', ls: +$('#s9-ls').value,
      warmup: +$('#s9-warm').value, lr: +$('#s9-lr').value, V: V, maxLen: MAXLEN, seed: 7
    };
  }
  function cfgText(c) {
    return 'N=' + c.N + ' · h=' + c.h + ' · d=' + c.d + ' · PE ' + ({ sin: '사인파', learned: '학습형', none: '없음' })[c.pe] + (c.scale ? '' : ' · 스케일 끔') + (c.ls ? ' · LS ' + c.ls : '');
  }

  /* ---------- 상태 ---------- */
  var model = null, cfg = null, running = false, busy = false;
  var evalData = null, probeX = [], lossPts = [], ema = null, accPts = [], snaps = [];
  var lastUI = 0, lastMaps = 0, t0 = 0, stepsAtT0 = 0, speed = 0;
  var SNAP_STEPS = [0, 25, 50, 100, 150, 200, 300, 400, 600, 800, 1200, 1600, 2400, 3200];
  var kind = 'cross', layer = -1, lastAttn = null, drawnSnaps = -1;
  var stepFmt = function (v) { return Lab.int(v); };

  var lossChart = new Lab.Chart($('#s9-loss'), {
    height: 220, title: '학습 loss',
    x: { domain: [0, 100], label: 'step', name: 'step', fmt: Lab.compact, tipFmt: stepFmt },
    y: { type: 'log', domain: [0.003, 4], fmt: Lab.compact }, series: []
  });
  var accChart = new Lab.Chart($('#s9-acc'), {
    height: 220, title: '정확도 (고정 평가 문장 64개, 100 step마다)',
    x: { domain: [0, 100], label: 'step', name: 'step', fmt: Lab.compact, tipFmt: stepFmt },
    y: { domain: [0, 1.02], ticks: [0, 0.25, 0.5, 0.75, 1], fmt: function (v) { return Math.round(v * 100) + '%'; } },
    tipFmt: function (v) { return fmt(v * 100, 1) + '%'; }, series: []
  });
  Lab.seg($('#s9-kind'), [{ v: 'cross', label: 'Cross' }, { v: 'enc', label: '인코더 self' }, { v: 'dec', label: '디코더 self' }], kind, function (v) { kind = v; drawMaps(); });
  function layerSeg() {
    var N = cfg.N;
    if (layer < 0 || layer >= N) layer = N - 1;
    Lab.seg($('#s9-layer'), Array.from({ length: N }, function (_, i) { return { v: i, label: String(i + 1) }; }), layer, function (v) { layer = +v; drawMaps(); });
  }
  function syncProbe() {
    var p = parseLetters($('#s9-probe').value);
    if (p.length !== cfg.L) {
      p = parseLetters(PROBE_BASE.slice(0, cfg.L));
      $('#s9-probe').value = PROBE_BASE.slice(0, cfg.L);
    }
    probeX = p;
  }

  function reset() {
    running = false;
    runBtn.textContent = '학습 시작';
    cfg = readCfg();
    model = new TT.Model(cfg);
    evalData = makeData(EVAL_N, cfg.L, cfg.task, TT.mulberry(4242 + cfg.L * 13));
    lossPts = []; ema = null; accPts = []; snaps = [];
    syncProbe();
    layerSeg();
    var ev = model.evaluate(evalData, BOS);
    accPts.push([0, ev.tok, ev.seq]);
    takeSnap();
    refreshAttn();
    updateUI(true);
    setStatus('준비됨 · 학습 전 무작위 초기화 상태 · 파라미터 ' + Lab.int(model.nParams) + '개');
  }

  function avgHeads(H) {
    return H[0].map(function (row, i) { return row.map(function (_, j) { return H.reduce(function (s, m) { return s + m[i][j]; }, 0) / H.length; }); });
  }
  function takeSnap() {
    var a = model.attnMaps(probeX, [BOS].concat(TASKS[cfg.task](probeX)));
    snaps.push({ step: model.step, m: avgHeads(a.cross[a.cross.length - 1]) });
  }
  function refreshAttn() {
    var tin = [BOS].concat(TASKS[cfg.task](probeX));
    lastAttn = { a: model.attnMaps(probeX, tin), tin: tin, x: probeX.slice() };
    drawMaps();
  }

  function statHtml(step, loss, tok, seq, sp) {
    return '<div class="stat"><b>' + step + '</b>step</div>' +
      '<div class="stat"><b>' + loss + '</b>loss (평활)</div>' +
      '<div class="stat"><b>' + tok + '</b>토큰 정확도</div>' +
      '<div class="stat"><b>' + seq + '</b>문장 정확도 (greedy)</div>' +
      '<div class="stat"><b>' + sp + '</b>step / 초</div>';
  }
  function lsFloor(e) {
    var qc = 1 - e + e / V, qo = e / V;
    return -(qc * Math.log(qc) + (V - 1) * qo * Math.log(qo));
  }
  function updateUI(force) {
    var now = performance.now();
    if (!force && now - lastUI < 400) return;
    lastUI = now;
    var last = accPts[accPts.length - 1] || [0, 0, 0];
    $('#s9-stats').innerHTML = statHtml(Lab.int(model.step), ema == null ? '—' : fmt(ema, 4), fmt(last[1] * 100, 1) + '%', fmt(last[2] * 100, 1) + '%', running ? fmt(speed, 1) : '—');
    var stride = Math.max(1, Math.ceil(lossPts.length / 500)), raw = [], sm = [];
    for (var i = 0; i < lossPts.length; i += stride) { raw.push([lossPts[i][0], lossPts[i][1]]); sm.push([lossPts[i][0], lossPts[i][2]]); }
    if (lossPts.length) { var lp = lossPts[lossPts.length - 1]; raw.push([lp[0], lp[1]]); sm.push([lp[0], lp[2]]); }
    var xd = [0, Math.max(100, model.step)];
    var floor = cfg.ls > 0 ? lsFloor(cfg.ls) : null;
    lossChart.set({
      x: { domain: xd, label: 'step', name: 'step', fmt: Lab.compact, tipFmt: stepFmt },
      series: [
        { name: '매 step', color: 'var(--c6)', data: raw, width: 1, opacity: 0.45, noTip: true },
        { name: '지수 평활', color: 'var(--c1)', data: sm, width: 2.2 }
      ],
      hlines: floor ? [{ y: floor, label: 'label smoothing 하한 ≈ ' + fmt(floor, 2), color: 'var(--good)' }] : []
    });
    accChart.set({
      x: { domain: xd, label: 'step', name: 'step', fmt: Lab.compact, tipFmt: stepFmt },
      series: [
        { name: '토큰 (teacher forcing)', color: 'var(--c3)', data: accPts.map(function (p) { return [p[0], p[1]]; }) },
        { name: '문장 전체 (greedy 생성)', color: 'var(--c2)', data: accPts.map(function (p) { return [p[0], p[2]]; }) }
      ]
    });
    if (force || snaps.length !== drawnSnaps) { drawnSnaps = snaps.length; drawSnaps(); }
  }

  /* ---------- attention map ---------- */
  function rowLabels(tin) {
    var y = tin.slice(1).concat([EOS]);
    return tin.map(function (t, i) { return tokStr(t) + '→' + tokStr(y[i]); });
  }
  function drawMaps() {
    var box = $('#s9-maps');
    if (!lastAttn) { box.innerHTML = ''; return; }
    var li = Math.min(layer, cfg.N - 1);
    var A = lastAttn.a[kind][li], h = A.length;
    var srcL = lastAttn.x.map(tokStr), rl = rowLabels(lastAttn.tin), tinL = lastAttn.tin.map(tokStr);
    var rows = kind === 'enc' ? srcL : rl, cols = kind === 'dec' ? tinL : srcL;
    var maps = A.map(function (m, g) { return { m: m, cap: '헤드 ' + (g + 1) }; });
    if (h > 1) maps.push({ m: avgHeads(A), cap: '헤드 평균' });
    box.innerHTML = maps.map(function (mp) { return '<div class="map-cell"><span class="cap">' + mp.cap + '</span><div></div></div>'; }).join('');
    var label = { cross: 'Cross-attention · 행 = 디코더 위치("입력→만들어야 할 출력"), 열 = 소스 글자', enc: '인코더 self-attention · 행·열 모두 소스 글자', dec: '디코더 masked self-attention · 위 삼각형은 causal mask로 0' }[kind];
    maps.forEach(function (mp, g) {
      Lab.matrix(box.children[g].lastChild, mp.m, {
        rows: rows, cols: cols, range: [0, 1], values: false, cls: 'sm',
        onHover: function (i, j) {
          if (i === null) { $('#s9-map-read').textContent = label + ' · step ' + Lab.int(model.step); return; }
          $('#s9-map-read').textContent = mp.cap + ' · 층 ' + (li + 1) + ' · ' + rows[i] + ' 행이 ' + cols[j] + ' 열에 준 가중치 = ' + fmt(mp.m[i][j], 3);
        }
      });
    });
    $('#s9-map-read').textContent = label + ' · step ' + Lab.int(model.step);
  }
  function drawSnaps() {
    var box = $('#s9-snaps');
    var all = SNAP_STEPS.map(function (st) { return snaps.find(function (s) { return s.step === st; }) || { step: st, m: null }; });
    var L = cfg.L;
    box.innerHTML = all.map(function (s) { return '<div class="snap' + (s.m ? '' : ' empty') + '"><div></div><span class="cap">' + Lab.int(s.step) + '</span></div>'; }).join('');
    all.forEach(function (s, i) {
      var m = s.m || Array.from({ length: L + 1 }, function () { return new Array(L).fill(0); });
      Lab.matrix(box.children[i].firstChild, m, { range: [0, 1], values: false, cls: 'xxs' });
    });
  }

  /* ---------- 학습 루프 ---------- */
  function loop() {
    if (!running) return;
    var start = performance.now();
    try {
      while (running && performance.now() - start < 50) {
        var l = model.trainStep(makeData(BATCH, cfg.L, cfg.task, model.dataRng));
        ema = ema == null ? l : ema * 0.95 + l * 0.05;
        lossPts.push([model.step, l, ema]);
        if (SNAP_STEPS.indexOf(model.step) >= 0) takeSnap();
        if (model.step % EVAL_EVERY === 0) {
          var ev = model.evaluate(evalData, BOS);
          accPts.push([model.step, ev.tok, ev.seq]);
        }
        if (!Number.isFinite(l)) { running = false; setStatus('loss가 발산했습니다(NaN). 학습률을 낮추거나 warmup을 늘린 뒤 초기화하세요.'); }
      }
    } catch (e) {
      running = false;
      console.error(e);
      setStatus('오류: ' + e.message);
    }
    var now = performance.now();
    if (now - t0 > 1000) { speed = (model.step - stepsAtT0) / ((now - t0) / 1000); t0 = now; stepsAtT0 = model.step; }
    if (now - lastMaps > 500) { lastMaps = now; refreshAttn(); }
    updateUI();
    if (running) {
      setStatus('학습 중 · ' + TASK_NAME[cfg.task] + ' · 학습률 ' + model.lrAt(model.step).toExponential(1).replace('e-', 'e−'));
      setTimeout(loop, 0);
    } else {
      runBtn.textContent = '이어서 학습';
      refreshAttn();
      updateUI(true);
    }
  }
  runBtn.addEventListener('click', function () {
    if (busy) return;
    if (running) { running = false; setStatus('일시정지 · step ' + Lab.int(model.step)); return; }
    running = true;
    runBtn.textContent = '일시정지';
    t0 = performance.now(); stepsAtT0 = model.step;
    setTimeout(loop, 0);
  });
  $('#s9-reset').addEventListener('click', function () { if (!busy) reset(); });
  CFG_IDS.forEach(function (k) {
    $('#s9-' + k).addEventListener('change', function () {
      if (busy) return;
      reset();
      setStatus('설정이 바뀌어 모델을 새로 만들었습니다 · ' + cfgText(cfg));
    });
  });
  $('#s9-probe').addEventListener('change', function () {
    var p = parseLetters($('#s9-probe').value);
    if (p.length !== cfg.L) { $('#s9-map-read').textContent = '관찰 입력은 A–J 글자 ' + cfg.L + '개여야 합니다(현재 학습 길이 L = ' + cfg.L + ').'; return; }
    probeX = p;
    refreshAttn();
  });

  /* ---------- 직접 넣어 보기 ---------- */
  $('#s9-go').addEventListener('click', function () {
    var out = $('#s9-test-out');
    var x = parseLetters($('#s9-test').value);
    if (!x.length || x.length > 8) { out.textContent = 'A–J 글자를 1~8개 넣어 주세요.'; return; }
    var pred = Array.from(model.greedy(Int32Array.from(x), 1, x.length, BOS));
    var cut = pred.indexOf(EOS);
    var gen = cut >= 0 ? pred.slice(0, cut) : pred;
    var want = TASKS[cfg.task](x);
    var ok = gen.length === want.length && gen.every(function (t, i) { return t === want[i]; });
    var tin = [BOS].concat(gen.slice(0, x.length));
    while (tin.length < x.length + 1) tin.push(EOS);
    var a = model.attnMaps(x, tin);
    out.innerHTML = '';
    var txt = document.createElement('div');
    txt.textContent = '입력  ' + x.map(tokStr).join(' ') + '\n모델  ' + gen.map(tokStr).join(' ') + (cut >= 0 ? ' ‹/s›' : ' (‹/s› 없음)') + '\n정답  ' + want.map(tokStr).join(' ') + '   ' + (ok ? '✓ 맞음' : '✗ 틀림') +
      (x.length !== cfg.L ? '\n학습 때 본 길이(' + cfg.L + ')와 다른 입력입니다. 이 작은 모델에게 길이 일반화는 어려운 문제입니다.' : '') +
      (model.step < 50 ? '\n아직 거의 학습되지 않은 모델입니다. 먼저 학습을 돌려 보세요.' : '');
    out.appendChild(txt);
    var cap = document.createElement('div');
    cap.style.marginTop = '8px';
    cap.textContent = '생성할 때의 cross-attention (마지막 층, 헤드 평균)';
    out.appendChild(cap);
    var m = document.createElement('div');
    m.className = 'scroll-x';
    m.style.marginTop = '4px';
    out.appendChild(m);
    Lab.matrix(m, avgHeads(a.cross[a.cross.length - 1]), { rows: rowLabels(tin), cols: x.map(tokStr), range: [0, 1], values: false, cls: 'sm' });
  });

  /* ---------- Ablation ---------- */
  var ABL = [
    { key: 'base', label: '기준 (위 설정 그대로)', patch: {}, on: true },
    { key: 'h1', label: '(A) 헤드 1개', patch: { h: 1 }, on: true },
    { key: 'h4', label: '(A) 헤드 4개', patch: { h: 4 }, on: false },
    { key: 'n1', label: '(C) 층 1개', patch: { N: 1 }, on: false },
    { key: 'n3', label: '(C) 층 3개', patch: { N: 3 }, on: false },
    { key: 'ls', label: '(D) label smoothing 0.1', patch: { ls: 0.1 }, on: false },
    { key: 'learned', label: '(E) 학습형 위치 임베딩', patch: { pe: 'learned' }, on: false },
    { key: 'nope', label: '위치 인코딩 없음', patch: { pe: 'none' }, on: true },
    { key: 'noscale', label: '√d_k 스케일 끄기', patch: { scale: false }, on: true }
  ];
  $('#s9-abl-opts').innerHTML = ABL.map(function (a) {
    return '<label class="ctl"><input type="checkbox" id="s9-abl-' + a.key + '"' + (a.on ? ' checked' : '') + '> ' + a.label + '</label>';
  }).join('');
  var ablResults = [], ablStop = false;
  var ablChart = new Lab.Chart($('#s9-abl-chart'), {
    height: 240, title: 'loss 곡선 비교 (지수 평활)',
    x: { domain: [0, 600], label: 'step', name: 'step', fmt: Lab.compact, tipFmt: stepFmt },
    y: { type: 'log', domain: [0.003, 4], fmt: Lab.compact }, series: []
  });
  var COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--amber)', 'var(--good)', 'var(--bad)'];
  function drawAbl(cur) {
    var t = '<thead><tr><th>실험</th><th>설정</th><th class="num">토큰 정확도</th><th class="num">문장 정확도</th><th class="num">마지막 loss</th><th class="num">시간</th></tr></thead><tbody>';
    if (!ablResults.length && !cur) t += '<tr><td colspan="6" class="hint">실험을 고르고 실행하세요. 기본 선택(4개 × 400 step)은 2분 안팎 걸립니다.</td></tr>';
    var bestSeq = Math.max.apply(null, ablResults.map(function (r) { return r.seq; }).concat([-1]));
    ablResults.forEach(function (r) {
      t += '<tr><td><span class="swatch" style="background:' + r.color + '"></span>' + r.label + '</td><td class="f">' + cfgText(r.cfg) + '</td>' +
        '<td class="num">' + fmt(r.tok * 100, 1) + '%</td><td class="num' + (r.seq === bestSeq ? ' best' : r.seq < 0.2 ? ' worst' : '') + '">' + fmt(r.seq * 100, 1) + '%</td>' +
        '<td class="num">' + fmt(r.loss, 3) + (r.cfg.ls ? '*' : '') + '</td><td class="num">' + fmt(r.time, 1) + 's</td></tr>';
    });
    if (cur) t += '<tr class="sel"><td>' + cur.label + '</td><td class="f">' + cfgText(cur.cfg) + '</td><td colspan="4" class="hint">학습 중… step ' + cur.step + '</td></tr>';
    $('#s9-abl-table').innerHTML = t + '</tbody>' + (ablResults.some(function (r) { return r.cfg.ls; }) ? '<caption>* label smoothing을 쓰면 loss의 하한이 0이 아니므로 loss 대신 정확도로 비교하세요.</caption>' : '');
    ablChart.set({
      x: { domain: [0, +$('#s9-abl-steps').value], label: 'step', name: 'step', fmt: Lab.compact, tipFmt: stepFmt },
      series: ablResults.map(function (r) { return { name: r.label, color: r.color, data: r.curve }; }).concat(cur ? [{ name: cur.label + ' (진행 중)', color: cur.color, data: cur.curve, dash: '3 3' }] : [])
    });
  }
  drawAbl();
  function ablDone() {
    busy = false;
    $('#s9-abl-run').disabled = false; $('#s9-abl-stop').hidden = true; runBtn.disabled = false;
  }
  $('#s9-abl-run').addEventListener('click', function () {
    var picks = ABL.filter(function (a) { return $('#s9-abl-' + a.key).checked; });
    if (!picks.length) { $('#s9-abl-status').textContent = '실험을 하나 이상 고르세요.'; return; }
    if (busy) return;
    if (running) { running = false; setStatus('ablation 실행 중이라 일시정지했습니다 · step ' + Lab.int(model.step)); }
    busy = true; ablStop = false; ablResults = [];
    $('#s9-abl-run').disabled = true; $('#s9-abl-stop').hidden = false; runBtn.disabled = true;
    var steps = +$('#s9-abl-steps').value;
    var base = readCfg(), idx = 0, total = picks.length * steps, doneSteps = 0;
    var evalD = makeData(EVAL_N, base.L, base.task, TT.mulberry(4242 + base.L * 13));
    function finish() {
      ablDone();
      if (!ablStop) $('#s9-abl-prog').style.width = '100%';
      $('#s9-abl-status').textContent = ablStop ? '중단했습니다.' : '완료. 문장 정확도가 가장 높은 설정이 초록색입니다.';
      drawAbl();
    }
    function nextRun() {
      if (idx >= picks.length || ablStop) { finish(); return; }
      var p = picks[idx];
      var c = Object.assign({}, base, p.patch);
      var m = new TT.Model(c), em = null, curve = [], st = performance.now();
      var cur = { label: p.label, cfg: c, color: COLORS[idx % COLORS.length], curve: curve, step: 0 };
      var lastDraw = 0;
      function chunk() {
        if (ablStop) { finish(); return; }
        var s0 = performance.now();
        try {
          while (m.step < steps && performance.now() - s0 < 40) {
            var l = m.trainStep(makeData(BATCH, c.L, c.task, m.dataRng));
            em = em == null ? l : em * 0.95 + l * 0.05;
            if (m.step % 10 === 0 || m.step === 1) curve.push([m.step, em]);
            doneSteps++;
          }
        } catch (e) { console.error(e); ablStop = true; $('#s9-abl-status').textContent = '오류: ' + e.message; }
        cur.step = m.step;
        $('#s9-abl-prog').style.width = (doneSteps / total * 100).toFixed(1) + '%';
        $('#s9-abl-status').textContent = (idx + 1) + ' / ' + picks.length + ' · ' + p.label + ' · step ' + m.step + ' / ' + steps;
        if (performance.now() - lastDraw > 400) { lastDraw = performance.now(); drawAbl(cur); }
        if (m.step < steps) { setTimeout(chunk, 0); return; }
        var ev = m.evaluate(evalD, BOS);
        ablResults.push({ label: p.label, cfg: c, color: cur.color, curve: curve, tok: ev.tok, seq: ev.seq, loss: em, time: (performance.now() - st) / 1000 });
        drawAbl();
        idx++;
        setTimeout(nextRun, 0);
      }
      setTimeout(chunk, 0);
    }
    nextRun();
  });
  $('#s9-abl-stop').addEventListener('click', function () { ablStop = true; });

  /* ---------- 초기 화면: 학습 전 모델을 바로 만들어 둔다 ---------- */
  reset();
});
