/* §8 추론 — greedy 생성 애니메이션, beam search 트리 */
Lab.section('s8', function () {
  var $ = Lab.$, fmt = Lab.fmt, esc = Lab.esc;

  /* 설명용 다음 토큰 확률표 (실제 모델 출력 아님) */
  var P = {
    '': [['나는', 0.38], ['난', 0.32], ['사랑', 0.30]],
    '나는': [['너를', 0.45], ['당신을', 0.35], ['사랑해', 0.20]],
    '난': [['너를', 0.9], ['사랑해', 0.1]],
    '사랑': [['‹/s›', 0.9], ['해', 0.1]],
    '나는 너를': [['사랑해', 0.5], ['좋아해', 0.4], ['‹/s›', 0.1]],
    '나는 당신을': [['사랑해요', 0.8], ['사랑해', 0.2]],
    '난 너를': [['사랑해', 0.85], ['좋아해', 0.15]]
  };
  function dist(seq) { return P[seq.join(' ')] || [['‹/s›', 1]]; }
  function chip(t, cls) { return '<span class="tok' + (cls ? ' ' + cls : '') + (t.charAt(0) === '‹' ? ' sp' : '') + '">' + esc(t) + '</span>'; }

  /* ---------------- 실험 8-1: greedy ---------------- */
  var seq = [], done = false, timer = null;
  function draw81() {
    $('#s8-in').innerHTML = chip('‹s›') + seq.map(function (t, i) { return chip(t, i === seq.length - 1 ? 'new' : ''); }).join('');
    var prob = 1;
    seq.forEach(function (t, i) { var d = dist(seq.slice(0, i)); prob *= d.find(function (x) { return x[0] === t; })[1]; });
    if (done) {
      $('#s8-dist').className = '';
      $('#s8-dist').style.height = '';
      $('#s8-dist').style.maxWidth = '';
      $('#s8-dist').innerHTML = '<p class="note" style="margin:0">‹/s›가 나와 생성을 멈췄습니다. 결과: <b>' + esc(seq.slice(0, -1).join(' ')) + '</b> · 문장 확률 = ' + seq.map(function (t, i) { return fmt(dist(seq.slice(0, i)).find(function (x) { return x[0] === t; })[1], 2); }).join(' × ') + ' = ' + fmt(prob, 4) + '</p>';
      $('#s8-st').textContent = '디코더 ' + seq.length + '번 실행';
      return;
    }
    var d = dist(seq), best = 0;
    d.forEach(function (x, i) { if (x[1] > d[best][1]) best = i; });
    Lab.bars($('#s8-dist'), d.map(function (x, i) { return { label: x[0], value: x[1], cls: i === best ? 'max' : '' }; }), { max: 1, height: 140, digits: 2 });
    $('#s8-dist').style.maxWidth = (d.length * 90) + 'px';
    $('#s8-st').textContent = 'step ' + (seq.length + 1) + ' · 다음에 고를 토큰: "' + d[best][0] + '"' + (seq.length ? ' · 지금까지 확률 ' + fmt(prob, 3) : '');
  }
  function next81() {
    if (done) return;
    var d = dist(seq), best = d.reduce(function (a, b) { return b[1] > a[1] ? b : a; });
    seq.push(best[0]);
    if (best[0] === '‹/s›') done = true;
    draw81();
  }
  function stopAuto() { if (timer) clearInterval(timer); timer = null; $('#s8-auto').textContent = '자동 재생'; }
  $('#s8-next').addEventListener('click', function () { stopAuto(); next81(); });
  $('#s8-reset').addEventListener('click', function () { stopAuto(); seq = []; done = false; draw81(); });
  $('#s8-auto').addEventListener('click', function () {
    if (timer) { stopAuto(); return; }
    if (done) { seq = []; done = false; draw81(); }
    $('#s8-auto').textContent = '멈춤';
    timer = setInterval(function () { next81(); if (done) stopAuto(); }, 1100);
  });
  draw81();

  /* ---------------- 실험 8-2: beam search ---------------- */
  var K = 1, alpha = 0, shown = 99;
  var alphaInp = $('#s8-alpha');
  function beam(k, a) {
    var alive = [{ id: 'r', seq: [], logp: 0 }], steps = [], finished = [], uid = 0;
    for (var depth = 1; depth <= 6 && alive.length; depth++) {
      var cands = [];
      alive.forEach(function (b) {
        dist(b.seq).forEach(function (x) {
          cands.push({ id: 'n' + (uid++), parent: b.id, seq: b.seq.concat([x[0]]), tok: x[0], p: x[1], logp: b.logp + Math.log(x[1]), depth: depth });
        });
      });
      cands.sort(function (x, y) { return y.logp - x.logp; });
      var nextAlive = [];
      cands.forEach(function (c, i) {
        if (i < k) {
          if (c.tok === '‹/s›') { c.status = 'finished'; finished.push(c); } else { c.status = 'kept'; nextAlive.push(c); }
        } else c.status = 'pruned';
      });
      steps.push(cands);
      alive = nextAlive;
    }
    finished.forEach(function (f) { f.len = f.seq.length; f.lp = Math.pow((5 + f.len) / 6, a); f.score = f.logp / f.lp; });
    return { steps: steps, finished: finished };
  }
  Lab.seg($('#s8-k'), [1, 2, 3, 4].map(function (v) { return { v: v, label: v === 1 ? '1 (greedy)' : String(v) }; }), K, function (v) { K = +v; shown = 99; draw82(); });
  alphaInp.addEventListener('input', function () { alpha = +alphaInp.value; draw82(); });
  $('#s8-bstep').addEventListener('click', function () { var r = beam(K, alpha); shown = Math.min(shown >= r.steps.length ? 1 : shown + 1, r.steps.length); draw82(); });
  $('#s8-ball').addEventListener('click', function () { shown = 99; draw82(); });
  $('#s8-breset').addEventListener('click', function () { shown = 0; draw82(); });

  function draw82() {
    $('#s8-alpha-out').textContent = fmt(alpha, 1);
    var res = beam(K, alpha), steps = res.steps;
    var vis = Math.min(shown, steps.length);
    var complete = vis >= steps.length;
    var nodes = { r: { id: 'r', tok: '‹s›', depth: 0, status: 'root' } };
    var byDepth = [[nodes.r]];
    for (var d = 0; d < vis; d++) {
      var arr = steps[d].slice();
      arr.forEach(function (c) { nodes[c.id] = c; });
      byDepth.push(arr);
    }
    // 위치: 부모 순서대로 정렬해 선이 덜 엇갈리게
    var COLW = 162, NW = 136, NH = 38, GAP = 8, X0 = 12, Y0 = 34;
    var maxRows = Math.max.apply(null, byDepth.map(function (a) { return a.length; }));
    var H = Y0 + maxRows * (NH + GAP) + 10;
    byDepth.forEach(function (arr, dd) {
      if (dd > 0) {
        arr.sort(function (a, b) { var pa = nodes[a.parent].y, pb = nodes[b.parent].y; return pa !== pb ? pa - pb : b.logp - a.logp; });
      }
      var total = arr.length * (NH + GAP) - GAP;
      var start = Y0 + ((maxRows * (NH + GAP) - GAP) - total) / 2;
      arr.forEach(function (n, i) { n.x = X0 + dd * COLW; n.y = start + i * (NH + GAP); });
    });
    var best = null;
    if (complete && res.finished.length) best = res.finished.reduce(function (a, b) { return b.score > a.score ? b : a; });
    var bestSet = {};
    if (best) { var cur = best; while (cur) { bestSet[cur.id] = true; cur = cur.parent ? nodes[cur.parent] : null; } }
    var s = '';
    for (d = 0; d <= Math.max(vis, 0); d++) s += '<text class="colh" x="' + (X0 + d * COLW + NW / 2) + '" y="16" text-anchor="middle">' + (d === 0 ? '시작' : 'step ' + d) + '</text>';
    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id];
      if (!n.parent) return;
      var p = nodes[n.parent];
      var x1 = p.x + NW, y1 = p.y + NH / 2, x2 = n.x, y2 = n.y + NH / 2, mx = (x1 + x2) / 2;
      var cls = bestSet[id] ? 'best' : (n.status === 'pruned' ? '' : n.status);
      s += '<path class="edge ' + cls + '" d="M' + x1 + ' ' + y1 + 'C' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2 + '"/>';
    });
    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id];
      s += '<g class="node ' + n.status + (bestSet[id] ? ' best' : '') + '"><rect x="' + n.x + '" y="' + n.y + '" width="' + NW + '" height="' + NH + '" rx="6"/>' +
        '<text x="' + (n.x + 9) + '" y="' + (n.y + 16) + '">' + esc(n.tok) + (n.status === 'finished' ? ' ✓' : '') + '</text>' +
        (n.depth ? '<text class="p" x="' + (n.x + 9) + '" y="' + (n.y + 30) + '">p ' + fmt(n.p, 2) + ' · Σlog ' + fmt(n.logp, 2) + '</text>' : '') + '</g>';
    });
    var svg = $('#s8-tree');
    var Wd = X0 + Math.max(4, steps.length) * COLW + NW + 12;
    svg.setAttribute('viewBox', '0 0 ' + Wd + ' ' + Math.max(H, 120));
    svg.style.minWidth = Math.round(Wd * 0.85) + 'px';
    svg.innerHTML = s;

    var fin = res.finished.filter(function (f) { return f.depth <= vis; });
    var t = '<thead><tr><th>완성된 후보</th><th class="num">log P</th><th class="num">길이 |Y|</th><th class="num">lp(Y)</th><th class="num">점수 = log P / lp</th></tr></thead><tbody>';
    if (!fin.length) t += '<tr><td colspan="5" class="hint">아직 ‹/s›로 끝난 후보가 없습니다.</td></tr>';
    fin.slice().sort(function (a, b) { return b.score - a.score; }).forEach(function (f) {
      t += '<tr' + (best && f.id === best.id ? ' class="sel"' : '') + '><td>' + esc(f.seq.slice(0, -1).join(' ')) + ' <span class="hint">‹/s›</span></td><td class="num">' + fmt(f.logp, 3) + '</td><td class="num">' + f.len + '</td><td class="num">' + fmt(f.lp, 3) + '</td><td class="num' + (best && f.id === best.id ? ' best' : '') + '">' + fmt(f.score, 3) + '</td></tr>';
    });
    $('#s8-final').innerHTML = t + '</tbody>';

    var greedy = beam(1, alpha).finished[0];
    var v;
    if (!complete) v = 'step ' + vis + ' / ' + steps.length + ' 진행 중. 파란 테두리는 남은 beam, 초록은 완성, 점선은 버려진 후보입니다.';
    else if (best) {
      var txt = best.seq.slice(0, -1).join(' ');
      v = 'k = ' + K + ', α = ' + fmt(alpha, 1) + ' → 선택: "' + txt + '" (확률 ' + fmt(Math.exp(best.logp), 3) + ')';
      if (txt === '사랑') v += '\n확률은 가장 높지만 "I love you"의 번역으로는 불완전합니다. 짧은 후보가 유리한 beam search의 길이 편향입니다. α를 올려 보세요.';
      else if (K > 1 && best.id !== greedy.id && greedy.seq.join(' ') !== best.seq.join(' ')) v += '\ngreedy("' + greedy.seq.slice(0, -1).join(' ') + '", 확률 ' + fmt(Math.exp(greedy.logp), 3) + ')보다 확률이 ' + fmt(Math.exp(best.logp - greedy.logp), 1) + '배 높은 번역을 찾았습니다. 첫 토큰에서 "나는"(0.38)이 "난"(0.32)보다 높았지만, 그 뒤가 "난 너를"(0.9) 쪽이 훨씬 확실했기 때문입니다.';
      else if (K === 1) v += '\ngreedy는 첫 step에서 가장 높은 "나는"을 고른 뒤 되돌아가지 못합니다. k를 2로 올려 보세요.';
    }
    $('#s8-verdict').textContent = v;
  }
  draw82();
});
