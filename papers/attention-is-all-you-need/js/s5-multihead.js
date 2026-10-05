/* §5 Multi-Head Attention — shape 추적, 헤드별 map, 비용 비교 */
Lab.section('s5', function () {
  var $ = Lab.$, $$ = Lab.$$, M = Lab.M, fmt = Lab.fmt, esc = Lab.esc;

  /* ---------------- 실험 5-1: shape 추적 ---------------- */
  var STEPS = [
    { name: '입력 X', code: 'x', sym: ['B', 'n', 'd_model'], vis: 'flat0',
      note: '임베딩 + 위치 인코딩을 더한 입력입니다. 토큰 하나가 d_model차원 벡터 하나입니다.' },
    { name: 'Q 투영', code: 'q = x @ W_q', sym: ['B', 'n', 'd_model'], vis: 'flat',
      note: 'W<sup>Q</sup>(d_model × d_model)는 헤드별 W<sub>i</sub><sup>Q</sup>(d_model × d_k) h개를 옆으로 이어 붙인 것과 같습니다. 그래서 행렬 곱 한 번으로 모든 헤드의 query를 만듭니다. 색 띠가 각 헤드의 몫입니다. K, V도 똑같습니다.' },
    { name: '헤드 분리', code: 'q = q.view(B, n, h, d_k)', sym: ['B', 'n', 'h', 'd_k'], vis: 'split',
      note: '마지막 축 d_model을 h × d_k로 쪼갭니다. 메모리의 데이터는 그대로이고 해석만 바뀝니다(복사 없음).' },
    { name: '축 교환', code: 'q = q.transpose(1, 2)', sym: ['B', 'h', 'n', 'd_k'], vis: 'stack',
      note: '헤드 축을 앞으로 보내 (B, h)를 배치처럼 다룹니다. 이제 헤드마다 독립된 (n × d_k) 행렬이 한 장씩 있습니다.' },
    { name: '점수', code: 's = q @ k.transpose(-2, -1) / sqrt(d_k)', sym: ['B', 'h', 'n', 'n'], vis: 'maps',
      note: '헤드마다 n × n 점수 행렬이 생깁니다. 행렬 곱 한 번(batched matmul)으로 h장이 동시에 계산됩니다.' },
    { name: 'softmax', code: 'a = s.softmax(dim=-1)', sym: ['B', 'h', 'n', 'n'], vis: 'maps',
      note: '마지막 축(key 축)으로 정규화합니다. 헤드마다 서로 다른 attention map이 됩니다.' },
    { name: '가중합', code: 'o = a @ v', sym: ['B', 'h', 'n', 'd_k'], vis: 'stack',
      note: '헤드마다 (n × n)·(n × d_k) = (n × d_k). 각 헤드가 자기 부분공간의 value를 섞은 결과입니다.' },
    { name: '축 되돌리기', code: 'o = o.transpose(1, 2)', sym: ['B', 'n', 'h', 'd_k'], vis: 'split',
      note: '다시 토큰 축을 앞으로. transpose 후에는 메모리 배치가 연속적이지 않아 다음 단계에서 contiguous()가 필요합니다.' },
    { name: '헤드 합치기', code: 'o = o.contiguous().view(B, n, d_model)', sym: ['B', 'n', 'd_model'], vis: 'flat',
      note: 'h개 헤드의 출력을 이어 붙여(Concat) 다시 d_model차원이 됩니다.' },
    { name: '출력 투영', code: 'y = o @ W_o', sym: ['B', 'n', 'd_model'], vis: 'flat0',
      note: 'W<sup>O</sup>(h·d_v × d_model)가 헤드들의 결과를 섞습니다. 입력과 같은 모양이라 잔차 연결이 가능합니다.' }
  ];
  var cur = 1;
  var Bin = $('#s5-B'), nin = $('#s5-n'), dSel = $('#s5-d'), hSel = $('#s5-h');
  function cfg() {
    var d = +dSel.value, h = +hSel.value;
    return { B: Math.max(1, +Bin.value || 1), n: Math.max(1, +nin.value || 1), d_model: d, h: h, d_k: d / h };
  }
  function symHtml(sym) { return '(' + sym.join(', ').replace(/_(\w+)/g, '<sub>$1</sub>') + ')'; }

  function drawTable() {
    var c = cfg();
    $('#s5-dk').textContent = c.d_k;
    var h = '<thead><tr><th class="num">#</th><th>단계 · 코드</th><th>shape</th></tr></thead><tbody>';
    STEPS.forEach(function (s, i) {
      h += '<tr data-i="' + i + '" tabindex="0" role="button" style="cursor:pointer"' + (i === cur ? ' class="sel"' : '') + '>' +
        '<td class="num">' + (i + 1) + '</td><td><b>' + s.name + '</b><br><code>' + esc(s.code) + '</code></td>' +
        '<td><span class="shape">' + symHtml(s.sym) + '</span><br><span class="shape alt">(' + s.sym.map(function (k) { return c[k]; }).join(', ') + ')</span></td></tr>';
    });
    $('#s5-steps').innerHTML = h + '</tbody>';
    drawSvg();
    drawCost();
  }

  function drawSvg() {
    var c = cfg(), s = STEPS[cur], h = c.h, out = '';
    var X0 = 64, Y0 = 52, Wd = 320, Hn = 150;
    var col = function (i) { return Lab.headColor(i, h); };
    function vlabel(x, y, t) { return '<text x="' + x + '" y="' + y + '" text-anchor="middle" class="t-muted" transform="rotate(-90 ' + x + ' ' + y + ')">' + t + '</text>'; }
    if (s.vis === 'flat0' || s.vis === 'flat') {
      if (s.vis === 'flat0') {
        out += '<rect x="' + X0 + '" y="' + Y0 + '" width="' + Wd + '" height="' + Hn + '" rx="4" class="box"/>';
      } else {
        var bw = Wd / h;
        for (var i = 0; i < h; i++) out += '<rect x="' + (X0 + i * bw) + '" y="' + Y0 + '" width="' + bw + '" height="' + Hn + '" style="fill:' + col(i) + ';opacity:.32"/>';
        out += '<rect x="' + X0 + '" y="' + Y0 + '" width="' + Wd + '" height="' + Hn + '" rx="4" class="box" style="fill:none"/>';
      }
      out += '<text x="' + (X0 + Wd / 2) + '" y="' + (Y0 - 12) + '" text-anchor="middle">d<tspan baseline-shift="sub" font-size="9">model</tspan> = ' + c.d_model + '</text>';
      out += vlabel(X0 - 14, Y0 + Hn / 2, 'n = ' + c.n);
    } else if (s.vis === 'split') {
      var gap = h > 8 ? 3 : 7, bw2 = (Wd - gap * (h - 1)) / h;
      for (var g = 0; g < h; g++) {
        var x = X0 + g * (bw2 + gap);
        out += '<rect x="' + x.toFixed(1) + '" y="' + Y0 + '" width="' + bw2.toFixed(1) + '" height="' + Hn + '" rx="3" style="fill:' + col(g) + ';opacity:.45;stroke:' + col(g) + '"/>';
        if (bw2 > 24) out += '<text x="' + (x + bw2 / 2).toFixed(1) + '" y="' + (Y0 + Hn + 16) + '" text-anchor="middle" class="t-mono">h' + (g + 1) + '</text>';
      }
      out += '<text x="' + (X0 + Wd / 2) + '" y="' + (Y0 - 12) + '" text-anchor="middle">h × d<tspan baseline-shift="sub" font-size="9">k</tspan> = ' + h + ' × ' + c.d_k + '</text>';
      out += vlabel(X0 - 14, Y0 + Hn / 2, 'n = ' + c.n);
    } else {
      var maps = s.vis === 'maps';
      var cnt = Math.min(h, 8), dx = 15, dy = 11;
      var sw = maps ? 130 : Math.max(46, Math.round(250 / Math.sqrt(h))), sh = maps ? 130 : Hn - 10;
      var top = 40;
      for (var k = cnt - 1; k >= 0; k--) {
        var xx = X0 + k * dx, yy = top + (cnt - 1 - k) * dy;
        out += '<rect x="' + xx + '" y="' + yy + '" width="' + sw + '" height="' + sh + '" rx="3" style="fill:color-mix(in oklab, ' + col(k) + ' 26%, var(--surface));stroke:' + col(k) + ';stroke-width:1.3"/>';
        if (maps && k === 0) {
          var cells = 6, cs = sw / cells;
          for (var a = 0; a < cells; a++) for (var b = 0; b < cells; b++) {
            var v = Math.exp(-Math.pow(a - b - (cur === 4 ? 0.6 : 1), 2) / 1.6);
            out += '<rect x="' + (xx + b * cs + 1).toFixed(1) + '" y="' + (yy + a * cs + 1).toFixed(1) + '" width="' + (cs - 2).toFixed(1) + '" height="' + (cs - 2).toFixed(1) + '" style="fill:var(--heat-1);opacity:' + (0.08 + v * 0.8).toFixed(2) + '"/>';
          }
        }
        if (k === 0) {
          out += '<text x="' + (xx + sw / 2) + '" y="' + (yy + sh + 16) + '" text-anchor="middle" class="t-mono">' + (maps ? 'n × n' : 'n × d_k') + '</text>';
        }
      }
      out += '<text x="' + (X0 + 150) + '" y="22" text-anchor="middle">헤드 ' + h + '개 × (' + (maps ? c.n + ' × ' + c.n : c.n + ' × ' + c.d_k) + ')' + (h > 8 ? ' · 8장만 표시' : '') + '</text>';
    }
    $('#s5-svg').innerHTML = out;
    $('#s5-note').innerHTML = '<b>' + (cur + 1) + '. ' + s.name + '</b> · ' + s.note;
  }
  $('#s5-steps').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-i]');
    if (!tr) return;
    cur = +tr.dataset.i; drawTable();
  });
  $('#s5-steps').addEventListener('keydown', function (e) {
    var tr = e.target.closest('tr[data-i]');
    if (!tr) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cur = +tr.dataset.i; drawTable(); $('#s5-steps tr[data-i="' + cur + '"]').focus(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      cur = Lab.clamp(cur + (e.key === 'ArrowDown' ? 1 : -1), 0, STEPS.length - 1);
      drawTable(); $('#s5-steps tr[data-i="' + cur + '"]').focus();
    }
  });
  [Bin, nin].forEach(function (el) { el.addEventListener('input', drawTable); });
  [dSel, hSel].forEach(function (el) { el.addEventListener('change', drawTable); });

  /* ---------------- 실험 5-3: 비용 비교 ---------------- */
  function drawCost() {
    var c = cfg(), n = c.n, d = c.d_model, h = c.h, dk = c.d_k;
    var rows = [
      ['W<sup>Q</sup>, W<sup>K</sup>, W<sup>V</sup> 파라미터', 3 * d * d, h * 3 * d * dk],
      ['W<sup>O</sup> 파라미터', d * d, h * dk * d],
      ['투영 연산 (Q, K, V, O)', 4 * n * d * d, 4 * n * d * d],
      ['점수 QKᵀ', n * n * d, h * n * n * dk],
      ['가중합 A·V', n * n * d, h * n * n * dk],
      ['attention 행렬 원소 수 (메모리)', n * n, h * n * n]
    ];
    var html = '<thead><tr><th>항목</th><th class="num">헤드 1개 (d<sub>k</sub> = ' + d + ')</th><th class="num">헤드 ' + h + '개 (d<sub>k</sub> = ' + dk + ')</th><th class="num">비율</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var ratio = r[2] / r[1];
      html += '<tr><td>' + r[0] + '</td><td class="num">' + Lab.int(r[1]) + '</td><td class="num">' + Lab.int(r[2]) + '</td><td class="num' + (Math.abs(ratio - 1) < 1e-9 ? ' best' : ' worst') + '">' + (Math.abs(ratio - 1) < 1e-9 ? '같음' : '× ' + fmt(ratio, 0)) + '</td></tr>';
    });
    $('#s5-cost').innerHTML = html + '</tbody>';
  }
  drawTable();

  /* ---------------- 실험 5-2: 헤드별 attention map ---------------- */
  var words = ['the', 'cat', 'sat', 'on', 'the', 'mat'];
  var noun = [0, 1, 0, 0, 0, 1];
  var ang = { the: 0, cat: 72, sat: 144, on: 216, mat: 288 };
  var w1 = Math.PI / 6, w2 = Math.PI / 5, s1 = 5, s2 = 5, a = 3, b = 3;
  var X = words.map(function (w, i) {
    var t = ang[w] * Math.PI / 180;
    return [s1 * Math.cos(i * w1), s1 * Math.sin(i * w1), a * noun[i], a, b * Math.cos(t), b * Math.sin(t), s2 * Math.cos(i * w2), s2 * Math.sin(i * w2)];
  });
  var WQ = M.zeros(8, 8), WK = M.zeros(8, 8);
  WQ[0][0] = Math.cos(w1); WQ[0][1] = -Math.sin(w1); WQ[1][0] = Math.sin(w1); WQ[1][1] = Math.cos(w1);
  WQ[3][2] = 1;
  WQ[4][4] = 1; WQ[5][5] = 1;
  WQ[6][6] = Math.cos(w2); WQ[6][7] = Math.sin(w2); WQ[7][6] = -Math.sin(w2); WQ[7][7] = Math.cos(w2);
  WK[0][0] = 1; WK[1][1] = 1; WK[2][2] = 1; WK[4][4] = 1; WK[5][5] = 1; WK[6][6] = 1; WK[7][7] = 1;
  var Q = M.mul(X, WQ), K = M.mul(X, WK);
  var SUB = [
    { dims: '0–1', what: '위치 정보 A (위치 × 30° 회전)', head: 'W<sup>Q</sup>가 −30° 회전 → <b>직전 단어</b>를 찾음' },
    { dims: '2–3', what: '품사 (명사 여부, 상수 1)', head: 'Query는 상수, Key는 명사 여부 → <b>명사</b>를 봄' },
    { dims: '4–5', what: '단어 정체 (단어마다 다른 방향)', head: 'W<sup>Q</sup> = W<sup>K</sup> = I → <b>같은 단어</b>를 봄' },
    { dims: '6–7', what: '위치 정보 B (위치 × 36° 회전)', head: 'W<sup>Q</sup>가 +36° 회전 → <b>다음 단어</b>를 찾음' }
  ];
  var REL = [
    { name: '직전 단어', tgt: function (i) { return i >= 1 ? [i - 1] : null; } },
    { name: '명사 (cat, mat)', tgt: function () { return [1, 5]; } },
    { name: '같은 단어', tgt: function (i) { return words.map(function (w, j) { return w === words[i] ? j : -1; }).filter(function (j) { return j >= 0; }); } },
    { name: '다음 단어', tgt: function (i) { return i <= 4 ? [i + 1] : null; } }
  ];
  function headMaps(h) {
    var dk = 8 / h, out = [];
    for (var g = 0; g < h; g++) {
      var Qg = M.cols(Q, g * dk, (g + 1) * dk), Kg = M.cols(K, g * dk, (g + 1) * dk);
      out.push(M.softmaxRows(M.scale(M.mul(Qg, M.T(Kg)), 1 / Math.sqrt(dk))));
    }
    return out;
  }
  function capture(h) {
    var maps = headMaps(h);
    return REL.map(function (rel, r) {
      var A = maps[Math.floor(r * h / 4)], tot = 0, cnt = 0;
      for (var i = 0; i < 6; i++) {
        var t = rel.tgt(i);
        if (!t) continue;
        tot += t.reduce(function (s, j) { return s + A[i][j]; }, 0); cnt++;
      }
      return tot / cnt;
    });
  }
  var caps = { 1: capture(1), 2: capture(2), 4: capture(4) };
  var hCur = 4;
  Lab.seg($('#s5-hsel'), [{ v: 1, label: '1' }, { v: 2, label: '2' }, { v: 4, label: '4' }], hCur, function (v) { hCur = +v; drawHeads(); });
  function drawHeads() {
    var h = hCur, dk = 8 / h;
    Lab.matrix($('#s5-X'), X, { rows: words, cols: ['0', '1', '2', '3', '4', '5', '6', '7'], mode: 'div', digits: 1, cls: 'sm', cw: '2.25rem' });
    $$('#s5-X .mx-cl').forEach(function (c, j) { c.style.boxShadow = 'inset 0 -3px 0 ' + Lab.headColor(Math.floor(j / dk), h); });
    var sub = '';
    for (var g = 0; g < h; g++) {
      var parts = SUB.slice(g * 4 / h, (g + 1) * 4 / h);
      sub += '<div><span class="swatch" style="background:' + Lab.headColor(g, h) + '"></span><b>헤드 ' + (g + 1) + '</b> · 차원 ' + (g * dk) + '–' + ((g + 1) * dk - 1) + '<br><span style="color:var(--ink-2)">' +
        parts.map(function (p) { return p.what + ': ' + p.head; }).join('<br>') + '</span></div>';
    }
    $('#s5-sub').innerHTML = sub;
    var maps = headMaps(h), box = $('#s5-maps');
    box.innerHTML = maps.map(function (_, g) {
      return '<div class="map-cell"><span class="cap" style="color:' + Lab.headColor(g, h) + '">■ 헤드 ' + (g + 1) + (h === 4 ? ' · ' + ['직전 단어', '명사', '같은 단어', '다음 단어'][g] : h === 1 ? ' · 네 부분공간 합산' : ' · 부분공간 ' + (g * 2 + 1) + '+' + (g * 2 + 2)) + '</span><div></div></div>';
    }).join('');
    maps.forEach(function (A, g) {
      Lab.matrix(box.children[g].lastChild, A, { rows: words, cols: words, range: [0, 1], digits: 2, cls: 'sm', cw: '2.1rem' });
    });
    var t = '<thead><tr><th>관계</th><th class="num' + (h === 1 ? ' cur' : '') + '">h = 1</th><th class="num' + (h === 2 ? ' cur' : '') + '">h = 2</th><th class="num' + (h === 4 ? ' cur' : '') + '">h = 4</th></tr></thead><tbody>';
    REL.forEach(function (rel, r) {
      t += '<tr><td>' + rel.name + '</td>' + [1, 2, 4].map(function (hh) {
        return '<td class="num' + (hh === h ? ' cur' : '') + '">' + fmt(caps[hh][r], 2) + '</td>';
      }).join('') + '</tr>';
    });
    $('#s5-rel').innerHTML = t + '</tbody><caption>각 관계가 가리키는 칸에 준 가중치의 합(토큰 평균). 1에 가까울수록 그 관계를 정확히 봅니다.</caption>';
  }
  drawHeads();
});
