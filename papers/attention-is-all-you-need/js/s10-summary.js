/* §10 전체 정리 — 텐서 shape 추적표, 파라미터 수 계산 */
Lab.section('s10', function () {
  var $ = Lab.$, fmt = Lab.fmt;

  /* ---------------- 실험 10-1: shape 추적표 ---------------- */
  var PRE = {
    base: { d: 512, h: 8, dff: 2048, V: 37000, N: 6 },
    big: { d: 1024, h: 16, dff: 4096, V: 37000, N: 6 }
  };
  var shapePreset = 'base';
  Lab.seg($('#s10-preset'), [{ v: 'base', label: 'base' }, { v: 'big', label: 'big' }], shapePreset, function (v) { shapePreset = v; drawShapes(); });
  function bytes(n) {
    var b = n * 4;
    if (b >= 1e9) return fmt(b / 1e9, 2) + ' GB';
    if (b >= 1e6) return fmt(b / 1e6, 1) + ' MB';
    if (b >= 1e3) return fmt(b / 1e3, 1) + ' KB';
    return b + ' B';
  }
  function drawShapes() {
    var p = PRE[shapePreset];
    var c = { B: Math.max(1, +$('#s10-B').value || 1), ns: Math.max(1, +$('#s10-ns').value || 1), nt: Math.max(1, +$('#s10-nt').value || 1), d: p.d, h: p.h, dk: p.d / p.h, dff: p.dff, V: p.V };
    var R = [
      ['g', '인코더 입력'],
      ['소스 토큰 ID', ['B', 'n_src'], [c.B, c.ns]],
      ['임베딩 × √d_model + 위치 인코딩', ['B', 'n_src', 'd_model'], [c.B, c.ns, c.d]],
      ['g', '인코더 층 (× N, 층 하나 기준)'],
      ['Q · K · V (헤드 분리 후, 각각)', ['B', 'h', 'n_src', 'd_k'], [c.B, c.h, c.ns, c.dk]],
      ['self-attention 행렬', ['B', 'h', 'n_src', 'n_src'], [c.B, c.h, c.ns, c.ns], 'att'],
      ['헤드 합치기 → W^O → Add & Norm', ['B', 'n_src', 'd_model'], [c.B, c.ns, c.d]],
      ['FFN 은닉 (ReLU 후)', ['B', 'n_src', 'd_ff'], [c.B, c.ns, c.dff]],
      ['층 출력 = 다음 층 입력', ['B', 'n_src', 'd_model'], [c.B, c.ns, c.d]],
      ['g', '디코더 입력'],
      ['타깃 토큰 ID (shifted right)', ['B', 'n_tgt'], [c.B, c.nt]],
      ['임베딩 × √d_model + 위치 인코딩', ['B', 'n_tgt', 'd_model'], [c.B, c.nt, c.d]],
      ['g', '디코더 층 (× N, 층 하나 기준)'],
      ['masked self-attention 행렬', ['B', 'h', 'n_tgt', 'n_tgt'], [c.B, c.h, c.nt, c.nt], 'att'],
      ['cross-attention Q (디코더에서)', ['B', 'h', 'n_tgt', 'd_k'], [c.B, c.h, c.nt, c.dk]],
      ['cross-attention K · V (인코더 memory에서)', ['B', 'h', 'n_src', 'd_k'], [c.B, c.h, c.ns, c.dk]],
      ['cross-attention 행렬', ['B', 'h', 'n_tgt', 'n_src'], [c.B, c.h, c.nt, c.ns], 'att'],
      ['FFN 은닉', ['B', 'n_tgt', 'd_ff'], [c.B, c.nt, c.dff]],
      ['층 출력', ['B', 'n_tgt', 'd_model'], [c.B, c.nt, c.d]],
      ['g', '출력'],
      ['로짓 (공유 가중치 Linear)', ['B', 'n_tgt', 'V'], [c.B, c.nt, c.V], 'big'],
      ['다음 토큰 확률 (softmax)', ['B', 'n_tgt', 'V'], [c.B, c.nt, c.V], 'big']
    ];
    var maxN = 0;
    R.forEach(function (r) { if (r[0] !== 'g') maxN = Math.max(maxN, r[2].reduce(function (a, b) { return a * b; }, 1)); });
    var h = '<thead><tr><th>텐서</th><th>shape</th><th>값</th><th class="num">원소 수</th><th class="num">fp32 메모리</th></tr></thead><tbody>';
    R.forEach(function (r) {
      if (r[0] === 'g') { h += '<tr class="group"><td colspan="5">' + r[1] + '</td></tr>'; return; }
      var n = r[2].reduce(function (a, b) { return a * b; }, 1);
      h += '<tr><td>' + r[0].replace('W^O', 'W<sup>O</sup>').replace('√d_model', '√d<sub>model</sub>') + '</td><td><span class="shape">(' + r[1].join(', ').replace(/_(\w+)/g, '<sub>$1</sub>') + ')</span></td>' +
        '<td class="f">(' + r[2].map(Lab.int).join(', ') + ')</td><td class="num">' + Lab.compact(n) + '</td><td class="num' + (n === maxN ? ' worst' : '') + '">' + bytes(n) + '</td></tr>';
    });
    $('#s10-shapes').innerHTML = h + '</tbody><caption>학습 시 역전파를 위해 이 값들을 층마다 저장합니다. 빨간 값이 가장 큰 텐서입니다. n이 커지면 attention 행렬(n²)이, 어휘가 크면 로짓(n × V)이 메모리를 지배합니다.</caption>';
  }
  ['#s10-B', '#s10-ns', '#s10-nt'].forEach(function (id) { $(id).addEventListener('input', drawShapes); });
  drawShapes();

  /* ---------------- 실험 10-2: 파라미터 수 ---------------- */
  var PP = {
    base: { d: 512, dff: 2048, h: 8, N: 6, V: 37000, tie: true },
    big: { d: 1024, dff: 4096, h: 16, N: 6, V: 37000, tie: true },
    toy: { d: 32, dff: 128, h: 2, N: 2, V: 13, tie: true }
  };
  var ppreset = 'base';
  var ids = { d: '#s10-d', dff: '#s10-ff', h: '#s10-h', N: '#s10-N', V: '#s10-V' };
  function setPreset(k) {
    ppreset = k;
    var p = PP[k];
    Object.keys(ids).forEach(function (f) { $(ids[f]).value = p[f]; });
    $('#s10-tie').checked = p.tie;
    drawParams();
  }
  var pseg = Lab.seg($('#s10-ppreset'), [{ v: 'base', label: 'base' }, { v: 'big', label: 'big' }, { v: 'toy', label: '§9 실습 모델' }], ppreset, setPreset);
  function drawParams() {
    var d = Math.max(1, +$(ids.d).value || 1), dff = Math.max(1, +$(ids.dff).value || 1), h = Math.max(1, +$(ids.h).value || 1);
    var N = Math.max(1, +$(ids.N).value || 1), Vv = Math.max(1, +$(ids.V).value || 1), tie = $('#s10-tie').checked;
    var attn = 4 * (d * d + d), ffn = d * dff + dff + dff * d + d;
    var parts = [
      { k: '임베딩' + (tie ? ' (소스·타깃·출력 공유)' : ' (소스 + 타깃 + 출력 Linear)'), f: tie ? 'V·d' : '3·V·d', v: (tie ? 1 : 3) * Vv * d, c: 'var(--c4)' },
      { k: '인코더 self-attention', f: 'N·4(d² + d)', v: N * attn, c: 'var(--c2)' },
      { k: '인코더 FFN', f: 'N·(2·d·d_ff + d_ff + d)', v: N * ffn, c: 'var(--c1)' },
      { k: '디코더 masked self-attention', f: 'N·4(d² + d)', v: N * attn, c: 'color-mix(in oklab, var(--c2) 70%, var(--surface))' },
      { k: '디코더 cross-attention', f: 'N·4(d² + d)', v: N * attn, c: 'color-mix(in oklab, var(--c2) 45%, var(--surface))' },
      { k: '디코더 FFN', f: 'N·(2·d·d_ff + d_ff + d)', v: N * ffn, c: 'color-mix(in oklab, var(--c1) 60%, var(--surface))' },
      { k: 'LayerNorm γ, β (인코더 2개 + 디코더 3개 / 층)', f: 'N·5·2d', v: N * 10 * d, c: 'var(--c3)' }
    ];
    var total = parts.reduce(function (s, p) { return s + p.v; }, 0);
    $('#s10-bar').innerHTML = parts.map(function (p) { return '<span style="width:' + (p.v / total * 100).toFixed(3) + '%;background:' + p.c + '" title="' + p.k + '"></span>'; }).join('');
    var t = '<thead><tr><th>부분</th><th>식</th><th class="num">파라미터</th><th class="num">비율</th></tr></thead><tbody>';
    parts.forEach(function (p) {
      t += '<tr><td><span class="swatch" style="background:' + p.c + '"></span>' + p.k + '</td><td class="f">' + p.f + '</td><td class="num">' + Lab.int(p.v) + '</td><td class="num">' + fmt(p.v / total * 100, p.v / total < 0.01 ? 2 : 1) + '%</td></tr>';
    });
    var ffnAll = 2 * N * ffn, attAll = 3 * N * attn;
    t += '<tr><td><b>합계</b></td><td></td><td class="num"><b>' + Lab.int(total) + '</b></td><td class="num">100%</td></tr></tbody>';
    $('#s10-params').innerHTML = t;
    var msg = '총 ' + Lab.int(total) + '개 ≈ ' + Lab.kor(total) + '개 · FFN ' + fmt(ffnAll / total * 100, 0) + '%, attention ' + fmt(attAll / total * 100, 0) + '%, 임베딩 ' + fmt(parts[0].v / total * 100, 0) + '%';
    if (d % h !== 0) msg += '\nd_model(' + d + ')이 h(' + h + ')로 나누어떨어지지 않아 헤드를 나눌 수 없습니다. 파라미터 수는 h와 무관하지만 구현은 불가능합니다.';
    else msg += '\nh = ' + h + ' → d_k = ' + (d / h) + '. h를 바꿔도 합계가 그대로인 것을 확인해 보세요(§4).';
    var same = function (k) { var p = PP[k]; return p.d === d && p.dff === dff && p.N === N && p.V === Vv && p.tie === tie; };
    if (same('base')) msg += '\n논문 Table 3 base: 65M. 차이 약 ' + fmt((65e6 - total) / 1e6, 1) + 'M은 실제 어휘 크기 등 구현 세부 차이로 보입니다.';
    if (same('big')) msg += '\n논문 Table 3 big: 213M.';
    if (same('toy')) msg += '\n§9 모델은 attention 투영에 bias를 두지 않고(−' + Lab.int(3 * N * 4 * d) + ') 출력 bias(+' + Vv + ')를 두어서, 학습 화면에는 ' + Lab.int(total - 3 * N * 4 * d + Vv) + '개로 표시됩니다.';
    $('#s10-total').textContent = msg;
  }
  Object.keys(ids).forEach(function (f) { $(ids[f]).addEventListener('input', function () { pseg.set(''); drawParams(); }); });
  $('#s10-tie').addEventListener('change', drawParams);
  setPreset('base');
});
