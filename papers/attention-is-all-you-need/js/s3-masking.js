/* §3 Masking — padding/causal 시각화, 미래 누출 실험, 병렬 = 순차 */
Lab.section('s3', function () {
  var $ = Lab.$, M = Lab.M, fmt = Lab.fmt;

  /* ---------------- 실험 3-1 ---------------- */
  var toks = ['<s>', '나는', '너를', '사랑해', '<pad>', '<pad>'];
  var nReal = 4, n = toks.length, d = 8;
  var r = Lab.rng(31);
  var X = Lab.randMat(n, d, r);
  var Wq = Lab.randMat(d, d, r, 1 / Math.sqrt(d)), Wk = Lab.randMat(d, d, r, 1 / Math.sqrt(d));
  var S = M.scale(M.mul(M.mul(X, Wq), M.T(M.mul(X, Wk))), 1 / Math.sqrt(d));
  S = M.map(S, function (v) { return v * 1.6; });
  var padCb = $('#s3-pad'), cauCb = $('#s3-causal');

  function maskFn() {
    var pad = padCb.checked, cau = cauCb.checked;
    return function (i, j) { return (pad && j >= nReal) || (cau && j > i); };
  }
  function draw31() {
    var mk = maskFn();
    var Mm = M.zeros(n, n).map(function (row, i) { return row.map(function (_, j) { return mk(i, j) ? -Infinity : 0; }); });
    var Sm = M.map(S, function (v, i, j) { return mk(i, j) ? -Infinity : v; });
    var A = M.softmaxRows(Sm);
    var padShare = A.map(function (row) { return [row[4] + row[5]]; });
    Lab.matrix($('#s3-M'), Mm, { rows: toks, cols: toks, mode: 'none', digits: 0, cls: 'sm', cw: '2.3rem' });
    Lab.matrix($('#s3-S'), Sm, { rows: toks, cols: toks, mode: 'div', digits: 1, cls: 'sm', cw: '2.3rem' });
    var wrap = $('#s3-A');
    wrap.innerHTML = '<div></div><div></div>';
    Lab.matrix(wrap.children[0], A, { rows: toks, cols: toks, range: [0, 1], digits: 2, cls: 'sm', cw: '2.3rem' });
    Lab.matrix(wrap.children[1], padShare, { cols: ['pad 몫'], range: [0, 1], digits: 2, cls: 'sm', cw: '2.8rem', mark: function (i, j, v) { return v > 0.001 ? 'hl' : ''; } });
    var leak = padShare.slice(0, nReal).reduce(function (a, b) { return a + b[0]; }, 0) / nReal;
    var msg = [];
    if (!padCb.checked) msg.push('padding mask 꺼짐 → 실제 단어 행들이 평균 ' + fmt(leak * 100, 1) + '%의 가중치를 의미 없는 <pad>에 낭비합니다. pad 개수가 배치마다 달라지면 같은 문장의 결과도 달라집니다.');
    else msg.push('padding mask 켜짐 → <pad> 열이 전부 0. pad 개수와 상관없이 같은 결과가 나옵니다.');
    if (!cauCb.checked) msg.push('causal mask 꺼짐 → "나는" 행이 뒤에 올 "너를", "사랑해"까지 봅니다. 학습 때 정답을 미리 보는 커닝입니다.');
    else msg.push('causal mask 켜짐 → 행 i는 열 1…i만 봅니다(아래 삼각형). <pad> 행은 계산되지만 loss에서 제외되므로 상관없습니다.');
    $('#s3-read').textContent = msg.join('\n');
  }
  padCb.addEventListener('change', draw31);
  cauCb.addEventListener('change', draw31);
  draw31();

  /* ---------------- 실험 3-2: 미래 누출 ---------------- */
  var r2 = Lab.rng(77);
  var X2 = Lab.randMat(6, d, r2);
  var Wq2 = Lab.randMat(d, d, r2, 1 / Math.sqrt(d)), Wk2 = Lab.randMat(d, d, r2, 1 / Math.sqrt(d)), Wv2 = Lab.randMat(d, d, r2, 1 / Math.sqrt(d));
  var kPos = 3, rollSeed = 5;
  var leakCb = $('#s3-leak-causal');
  function attnOut(Xin, causal) {
    return M.attention(M.mul(Xin, Wq2), M.mul(Xin, Wk2), M.mul(Xin, Wv2), { mask: causal ? function (i, j) { return j > i; } : null }).O;
  }
  var kSeg = Lab.seg($('#s3-k'), [1, 2, 3, 4, 5, 6].map(function (v) { return { v: v - 1, label: String(v) }; }), kPos, function (v) { kPos = +v; draw32(); });
  void kSeg;
  function draw32() {
    var causal = leakCb.checked;
    var rr = Lab.rng(rollSeed * 131 + kPos);
    var X2b = X2.map(function (row, i) { return i === kPos ? row.map(function () { return Lab.gauss(rr); }) : row.slice(); });
    var O1 = attnOut(X2, causal), O2 = attnOut(X2b, causal);
    var diffs = O1.map(function (row, i) { return Math.sqrt(row.reduce(function (s, v, j) { return s + Math.pow(v - O2[i][j], 2); }, 0)); });
    Lab.bars($('#s3-diff'), diffs.map(function (v, i) {
      return { label: '위치 ' + (i + 1), value: v, cls: v > 1e-12 ? 'max' : 'muted' };
    }), { digits: 3, height: 130, fmt: function (v) { return v < 1e-12 ? '0' : Lab.fmt(v, 3); } });
    var changed = diffs.map(function (v, i) { return v > 1e-12 ? i + 1 : null; }).filter(Boolean);
    $('#s3-diff-read').textContent = (kPos + 1) + '번째 토큰을 바꿨을 때 출력이 달라진 위치: ' + changed.join(', ') +
      (causal ? '\n→ 1~' + kPos + '번째 출력은 정확히 0만큼 변했습니다. 앞 위치는 뒤를 보지 못합니다.' : '\n→ mask가 없으니 앞 위치의 출력까지 모두 바뀌었습니다. 미래 정보가 새어 들어간 것입니다.').replace('1~0번째 출력은 정확히 0만큼 변했습니다. 앞 위치는 뒤를 보지 못합니다.', '첫 번째 위치를 바꾸면 모든 위치가 그 토큰을 볼 수 있으니 전부 바뀝니다.');
  }
  leakCb.addEventListener('change', draw32);
  $('#s3-reroll').addEventListener('click', function () { rollSeed++; draw32(); });
  draw32();

  /* ---------------- 실험 3-3: 병렬 = 순차 ---------------- */
  var Q3 = M.mul(X2, Wq2), K3 = M.mul(X2, Wk2), V3 = M.mul(X2, Wv2);
  var Opar = M.attention(Q3, K3, V3, { mask: function (i, j) { return j > i; } }).O;
  var Oseq = Q3.map(function (q, t) {
    return M.attention([q], K3.slice(0, t + 1), V3.slice(0, t + 1)).O[0];
  });
  var maxDiff = 0;
  Oseq.forEach(function (row, i) { row.forEach(function (v, j) { maxDiff = Math.max(maxDiff, Math.abs(v - Opar[i][j])); }); });
  var rows6 = ['t=1', 't=2', 't=3', 't=4', 't=5', 't=6'];
  var range = (function () { var m = 0; Opar.forEach(function (r) { r.forEach(function (v) { m = Math.max(m, Math.abs(v)); }); }); return [-m, m]; })();
  var shown = 6, timer = null;
  function draw33() {
    var A = Oseq.map(function (row, i) { return i < shown ? row : row.map(function () { return 0; }); });
    Lab.matrix($('#s3-seq'), A, { rows: rows6, mode: 'div', range: range, values: false, cls: 'xs', cw: '1.6rem', ch: '1.35rem', mark: function (i) { return i >= shown ? 'dimc' : ''; } });
    Lab.matrix($('#s3-par'), Opar, { rows: rows6, mode: 'div', range: range, values: false, cls: 'xs', cw: '1.6rem', ch: '1.35rem' });
    $('#s3-eq').textContent = '두 결과의 최대 차이: ' + (maxDiff === 0 ? '0 (완전히 같음)' : maxDiff.toExponential(2) + ' (부동소수점 오차 수준)') +
      '\n순차: attention 6번(t마다 1행) · 병렬: 6 × 6 점수 행렬 한 번. 학습 때는 정답이 있으니 병렬로, 추론 때는 다음 토큰을 모르니 순차로 계산합니다.';
  }
  $('#s3-play').addEventListener('click', function () {
    if (timer) clearInterval(timer);
    shown = 0; draw33();
    $('#s3-play-st').textContent = '순차 0 / 6 · 병렬 1 / 1 (이미 완료)';
    timer = setInterval(function () {
      shown++;
      draw33();
      $('#s3-play-st').textContent = '순차 ' + shown + ' / 6 · 병렬 1 / 1';
      if (shown >= 6) { clearInterval(timer); timer = null; $('#s3-play-st').textContent = '순차 6번 = 병렬 1번. 결과는 같습니다.'; }
    }, 500);
  });
  draw33();
});
