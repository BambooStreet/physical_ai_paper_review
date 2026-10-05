/* §7 학습 디테일 — warmup 스케줄, label smoothing, teacher forcing vs autoregressive */
Lab.section('s7', function () {
  var $ = Lab.$, fmt = Lab.fmt, esc = Lab.esc;

  /* ---------------- 실험 7-1: warmup 학습률 ---------------- */
  function lr(step, d, w) { step = Math.max(step, 1); return Math.pow(d, -0.5) * Math.min(Math.pow(step, -0.5), step * Math.pow(w, -1.5)); }
  var wInp = $('#s7-w'), dSel = $('#s7-d');
  var xmax = 20000;
  Lab.seg($('#s7-range'), [{ v: 20000, label: '0–20K' }, { v: 100000, label: '0–100K' }, { v: 300000, label: '0–300K' }], xmax, function (v) { xmax = +v; drawLR(); });
  var sci = function (v) { return v === 0 ? '0' : v.toExponential(1).replace('e-', 'e−'); };
  var chart = new Lab.Chart($('#s7-chart'), {
    height: 260, title: '학습률 vs step',
    x: { label: 'step', name: 'step', fmt: Lab.compact, tipFmt: function (v) { return Lab.int(v); } },
    y: { fmt: sci }, tipFmt: sci, series: []
  });
  function curve(d, w) {
    var pts = [], N = 500;
    for (var i = 1; i <= N; i++) pts.push(Math.round(i * xmax / N));
    if (w <= xmax) pts.push(w);
    pts.sort(function (a, b) { return a - b; });
    return pts.map(function (s) { return [s, lr(s, d, w)]; });
  }
  function drawLR() {
    var w = +wInp.value, d = +dSel.value;
    $('#s7-w-out').textContent = Lab.int(w);
    var peak = lr(w, d, w), ref = lr(4000, 512, 4000);
    chart.set({
      x: { domain: [0, xmax], label: 'step', name: 'step', fmt: Lab.compact, tipFmt: function (v) { return Lab.int(v); } },
      y: { domain: [0, Math.max(peak, ref) * 1.12], fmt: sci },
      series: [
        { name: '논문 (512, 4000)', color: 'var(--c6)', dash: '5 4', data: curve(512, 4000), width: 1.6 },
        { name: '현재 (' + d + ', ' + Lab.int(w) + ')', color: 'var(--c1)', data: curve(d, w), area: true }
      ],
      points: w <= xmax ? [{ x: w, y: peak, label: '최고 ' + sci(peak) + ' (warmup 끝)' }] : [],
      vlines: w <= xmax ? [{ x: w, color: 'var(--muted)' }] : []
    });
    $('#s7-stats').innerHTML =
      '<div class="stat"><b>' + sci(peak) + '</b>최고 학습률</div>' +
      '<div class="stat"><b>' + Lab.int(w) + '</b>최고점 step</div>' +
      '<div class="stat"><b>' + fmt(peak / ref, 2) + '×</b>논문 설정 대비</div>' +
      '<div class="stat"><b>' + sci(lr(100000, d, w)) + '</b>100K step 학습률</div>';
  }
  wInp.addEventListener('input', drawLR);
  dSel.addEventListener('change', drawLR);
  drawLR();

  /* ---------------- 실험 7-2: label smoothing ---------------- */
  var K = 8, C = 2;
  var vocab = ['나는', '너를', '사랑해', '좋아해', '고양이', '커피', '의자', '‹/s›'];
  var eInp = $('#s7-eps'), pInp = $('#s7-p');
  var lossChart = new Lab.Chart($('#s7-loss'), {
    height: 260, title: 'Cross-entropy vs 정답 확률 p',
    x: { domain: [0, 1], label: '모델이 정답에 준 확률 p', name: 'p', fmt: function (v) { return fmt(v, 1); }, tipFmt: function (v) { return fmt(v, 3); } },
    y: { domain: [0, 3], ticks: [0, 0.5, 1, 1.5, 2, 2.5, 3], fmt: function (v) { return fmt(v, 1); } }, series: []
  });
  function ce(qc, p) {
    var po = (1 - p) / (K - 1);
    return -(qc * Math.log(p) + (1 - qc) * Math.log(po));
  }
  function drawLS() {
    var e = +eInp.value, p = +pInp.value;
    $('#s7-eps-out').textContent = fmt(e, 2);
    $('#s7-p-out').textContent = fmt(p, 3);
    var qc = 1 - e + e / K;
    Lab.bars($('#s7-hard'), vocab.map(function (w, i) { return { label: w, value: i === C ? 1 : 0, cls: i === C ? 'max' : '' }; }), { max: 1, height: 110, digits: 2 });
    Lab.bars($('#s7-soft'), vocab.map(function (w, i) { return { label: w, value: i === C ? qc : e / K, cls: i === C ? 'max' : '' }; }), { max: 1, height: 110, digits: 3 });
    var hard = [], soft = [];
    for (var t = 1; t <= 400; t++) {
      var pp = 0.02 + 0.979 * t / 400;
      hard.push([pp, ce(1, pp)]); soft.push([pp, ce(qc, pp)]);
    }
    var minL = ce(qc, qc);
    lossChart.set({
      series: [
        { name: '원-핫 정답 (ε = 0)', color: 'var(--c6)', data: hard, dash: '5 4' },
        { name: '스무딩 (ε = ' + fmt(e, 2) + ')', color: 'var(--c1)', data: soft }
      ],
      points: [
        { x: qc, y: minL, label: e > 0 ? '최소 p = ' + fmt(qc, 3) : '', color: 'var(--good)', below: true },
        { x: p, y: ce(qc, p), color: 'var(--amber)', r: 5 },
        { x: p, y: ce(1, p), color: 'var(--c6)', r: 4 }
      ],
      vlines: [{ x: p, label: 'p = ' + fmt(p, 3), color: 'var(--amber)' }]
    });
    $('#s7-ls-stats').innerHTML =
      '<div class="stat"><b>' + fmt(ce(1, p), 3) + '</b>원-핫 기준 loss</div>' +
      '<div class="stat' + (e > 0 && p > qc + 0.01 ? ' warn' : '') + '"><b>' + fmt(ce(qc, p), 3) + '</b>스무딩 기준 loss</div>' +
      '<div class="stat good"><b>' + fmt(qc, 4) + '</b>loss가 최소인 p</div>' +
      '<div class="stat"><b>' + fmt(minL, 3) + '</b>최솟값 (= 목표 분포의 엔트로피)</div>';
  }
  eInp.addEventListener('input', drawLS);
  pInp.addEventListener('input', drawLS);
  drawLS();

  /* ---------------- 실험 7-3: teacher forcing vs autoregressive ---------------- */
  var GT = ['나는', '너를', '사랑해', '‹/s›'];
  var mistakeCb = $('#s7-mistake');
  var arStep = 4;
  function chip(t, cls) { return '<span class="tok' + (cls ? ' ' + cls : '') + (t.charAt(0) === '‹' ? ' sp' : '') + '">' + esc(t) + '</span>'; }
  function tfPreds(m) { return m ? ['나는', '당신을', '사랑해', '‹/s›'] : GT.slice(); }
  function arSeq(m) { return m ? ['나는', '당신을', '사랑해요', '‹/s›'] : GT.slice(); }
  function drawTF() {
    var m = mistakeCb.checked;
    var inp = ['‹s›'].concat(GT.slice(0, 3));
    var pr = tfPreds(m);
    $('#s7-tf').innerHTML =
      '<div class="tok-row"><span>디코더 입력</span><div class="toks">' + inp.map(function (t) { return chip(t, 'gt'); }).join('') + '</div></div>' +
      '<div class="tok-row"><span>모델 예측</span><div class="toks">' + pr.map(function (t, i) { return chip(t, t === GT[i] ? '' : 'err'); }).join('') + '</div></div>' +
      '<div class="tok-row"><span>정답 (loss)</span><div class="toks">' + GT.map(function (t) { return chip(t); }).join('') + '</div></div>' +
      '<p class="note">입력이 항상 정답이라, 2번째에서 틀려도 3번째 위치의 입력은 여전히 "너를"입니다. 네 위치를 causal mask로 한 번에 계산합니다.</p>';
    var seq = arSeq(m), rows = '';
    for (var s = 0; s < 4; s++) {
      var shown = s < arStep;
      var input = ['‹s›'].concat(seq.slice(0, s));
      rows += '<div class="tok-row" style="' + (shown ? '' : 'opacity:.3') + '"><span>step ' + (s + 1) + '</span><div class="toks">' +
        input.map(function (t, i) { return chip(t, i > 0 && seq[i - 1] !== GT[i - 1] ? 'err' : ''); }).join('') +
        '<span class="hint">→</span>' + (shown ? chip(seq[s], seq[s] !== GT[s] ? 'err' : 'new') : chip('?', 'ghost')) + '</div></div>';
    }
    $('#s7-ar').innerHTML = rows + '<p class="note">디코더를 토큰 수만큼(여기선 4번) 실행합니다. 이전 단계의 출력이 다음 단계의 입력이 됩니다.</p>';
    var msg;
    if (!m) msg = '모델이 틀리지 않으면 학습과 추론의 결과가 같습니다. 차이는 계산 방식뿐입니다: 학습은 forward 1번, 추론은 forward 4번.';
    else msg = '학습 때는 2번째에서 틀려도 다음 입력이 정답이라 영향이 없습니다. 추론 때는 틀린 "당신을"이 다음 입력이 되어 이후 출력까지 바뀝니다(→ "사랑해요").\n모델은 학습 중 자기 실수가 섞인 입력을 본 적이 없습니다. 이 학습–추론 차이를 exposure bias라고 부릅니다.';
    $('#s7-tf-read').textContent = msg + (arStep < 4 ? '\n추론 ' + arStep + ' / 4 단계 진행됨' : '');
  }
  mistakeCb.addEventListener('change', drawTF);
  $('#s7-step').addEventListener('click', function () { arStep = arStep >= 4 ? 1 : arStep + 1; drawTF(); });
  $('#s7-reset').addEventListener('click', function () { arStep = 0; drawTF(); });
  drawTF();
});
