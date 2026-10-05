/* §11 그 이후 — Post-LN vs Pre-LN, RoPE, mask 패턴 */
Lab.section('s11', function () {
  var $ = Lab.$, fmt = Lab.fmt;

  /* ---------------- Post-LN vs Pre-LN ---------------- */
  var defs = '<defs><marker id="s11-ah" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" style="fill:var(--ink-2)"/></marker>' +
    '<marker id="s11-ahr" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" style="fill:var(--amber)"/></marker></defs>';
  function box(y, label, cls, amber) {
    return '<rect class="b ' + cls + '" x="50" y="' + y + '" width="140" height="30" rx="6"' + (amber ? ' style="stroke:var(--amber);stroke-width:2.4"' : '') + '/>' +
      '<text x="120" y="' + (y + 19.5) + '" text-anchor="middle">' + label + '</text>';
  }
  function plus(y) { return '<circle class="plus" cx="120" cy="' + y + '" r="11"/><path d="M114 ' + y + 'h12M120 ' + (y - 6) + 'v12" style="stroke:var(--ink-2);stroke-width:1.6"/>'; }
  function ar(d) { return '<path class="w" d="' + d + '" marker-end="url(#s11-ah)"/>'; }
  function res(d, end) { return '<path class="res" d="' + d + '"' + (end ? ' marker-end="url(#s11-ahr)"' : '') + '/>'; }
  // 잔차(주황)는 검은 배선 위에 그려서 경로 전체가 보이게 한다
  var post = defs +
    ar('M120 290V201') + box(170, 'Sublayer (Attn/FFN)', 'f') + ar('M120 170V142') + plus(130) + ar('M120 119V91') +
    box(60, 'LayerNorm', 'n', true) + ar('M120 60V18') +
    res('M120 245H240V130H132', true) +
    '<text x="120" y="12" text-anchor="middle">출력</text><text x="104" y="298" text-anchor="end">x</text>' +
    '<text x="248" y="190" style="font-size:11px;fill:var(--amber)">잔차</text>' +
    '<text x="196" y="80" style="font-size:11px;fill:var(--amber)">잔차가 LN 통과</text>';
  var pre = defs +
    ar('M120 290V231') + box(200, 'LayerNorm', 'n') + ar('M120 200V171') + box(140, 'Sublayer (Attn/FFN)', 'f') + ar('M120 140V112') + plus(100) +
    res('M120 255H240V100H132', true) + res('M120 89V18', true) +
    '<text x="120" y="12" text-anchor="middle">출력</text><text x="104" y="298" text-anchor="end">x</text>' +
    '<text x="248" y="180" style="font-size:11px;fill:var(--amber)">항등 경로</text>' +
    '<text x="248" y="194" style="font-size:11px;fill:var(--amber)">(연산 없음)</text>';
  $('#s11-post').innerHTML = post;
  $('#s11-pre').innerHTML = pre;

  /* ---------------- RoPE ---------------- */
  var mInp = $('#s11-m'), nInp = $('#s11-n');
  var TH = 20 * Math.PI / 180, ALPHA = 10 * Math.PI / 180, BETA = 80 * Math.PI / 180, PA = 0.8;
  function rope(m, n) { return Math.cos((BETA + n * TH) - (ALPHA + m * TH)); }
  function additive(m, n) {
    var q = [Math.cos(ALPHA) + PA * Math.cos(m * TH), Math.sin(ALPHA) + PA * Math.sin(m * TH)];
    var k = [Math.cos(BETA) + PA * Math.cos(n * TH), Math.sin(BETA) + PA * Math.sin(n * TH)];
    return q[0] * k[0] + q[1] * k[1];
  }
  var ropeChart = new Lab.Chart($('#s11-rope-chart'), {
    height: 190, title: '두 위치를 함께 s만큼 옮길 때 점수',
    x: { domain: [0, 15], label: '이동량 s', name: 's', fmt: function (v) { return String(Math.round(v)); } },
    y: { domain: [-1.2, 2.2], fmt: function (v) { return fmt(v, 1); } }, series: []
  });
  function drawRope() {
    var m = +mInp.value, n = +nInp.value;
    $('#s11-m-out').textContent = m;
    $('#s11-n-out').textContent = n;
    var C = 130, R = 92;
    var aq = ALPHA + m * TH, ak = BETA + n * TH;
    function pt(a, r) { return [C + r * Math.cos(a), C - r * Math.sin(a)]; }
    var q = pt(aq, R), k = pt(ak, R);
    var s = '<defs><marker id="s11-aq" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" style="fill:var(--c1)"/></marker>' +
      '<marker id="s11-ak" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" style="fill:var(--c2)"/></marker></defs>';
    s += '<line class="axis" x1="20" y1="130" x2="240" y2="130"/><line class="axis" x1="130" y1="20" x2="130" y2="240"/>';
    s += '<circle class="ring" cx="130" cy="130" r="' + R + '"/>';
    var a1 = Math.min(aq, ak), a2 = Math.max(aq, ak), r2 = 34;
    var p1 = pt(a1, r2), p2 = pt(a2, r2), large = (a2 - a1) % (2 * Math.PI) > Math.PI ? 1 : 0;
    s += '<path d="M' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + 'A' + r2 + ' ' + r2 + ' 0 ' + large + ' 0 ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1) + '" style="fill:none;stroke:var(--amber);stroke-width:2"/>';
    s += '<line x1="130" y1="130" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '" style="stroke:var(--c1);stroke-width:2.6" marker-end="url(#s11-aq)"/>';
    s += '<line x1="130" y1="130" x2="' + k[0].toFixed(1) + '" y2="' + k[1].toFixed(1) + '" style="stroke:var(--c2);stroke-width:2.6" marker-end="url(#s11-ak)"/>';
    var ql = pt(aq, R + 16), kl = pt(ak, R + 16);
    [ql, kl].forEach(function (p) { p[0] = Lab.clamp(p[0], 34, 226); p[1] = Lab.clamp(p[1], 14, 250); });
    s += '<text x="' + ql[0].toFixed(1) + '" y="' + (ql[1] + 4).toFixed(1) + '" text-anchor="middle" style="fill:var(--c1)">q·R(' + m + 'θ)</text>';
    s += '<text x="' + kl[0].toFixed(1) + '" y="' + (kl[1] + 4).toFixed(1) + '" text-anchor="middle" style="fill:var(--c2)">k·R(' + n + 'θ)</text>';
    $('#s11-rope').innerHTML = s;
    $('#s11-rope-stats').innerHTML =
      '<div class="stat"><b>' + (m - n) + '</b>상대 거리 m − n</div>' +
      '<div class="stat good"><b>' + fmt(rope(m, n), 3) + '</b>RoPE 점수</div>' +
      '<div class="stat"><b>' + fmt(additive(m, n), 3) + '</b>덧셈 PE 점수</div>';
    var rd = [], ad = [];
    for (var t = 0; t <= 15; t++) { rd.push([t, rope(m + t, n + t)]); ad.push([t, additive(m + t, n + t)]); }
    ropeChart.set({ series: [
      { name: 'RoPE: 거리만 같으면 같은 점수', color: 'var(--c1)', data: rd, width: 2.5 },
      { name: '덧셈 PE: 절대 위치에 따라 변함', color: 'var(--c2)', data: ad, dash: '5 4' }
    ] });
  }
  mInp.addEventListener('input', drawRope);
  nInp.addEventListener('input', drawRope);
  $('#s11-shift').addEventListener('click', function () {
    if (+mInp.value >= 20 || +nInp.value >= 20) { mInp.value = Math.max(0, +mInp.value - +nInp.value); nInp.value = 0; }
    else { mInp.value = +mInp.value + 1; nInp.value = +nInp.value + 1; }
    drawRope();
  });
  drawRope();

  /* ---------------- mask 패턴 ---------------- */
  var box11 = $('#s11-masks');
  var ones = function (r, c) { return Array.from({ length: r }, function () { return new Array(c).fill(1); }); };
  var SRC = ['I', 'love', 'you', '.'], TGT = ['‹s›', '나는', '너를', '사랑해'];
  var GPT = ['Q:', 'I', 'love', 'you', 'A:', '나는', '너를', '사랑해'];
  var items = [
    { cap: 'Enc–Dec · 인코더 self (양방향)', rows: SRC, cols: SRC, mask: function () { return false; } },
    { cap: 'Enc–Dec · 디코더 self (causal)', rows: TGT, cols: TGT, mask: function (i, j) { return j > i; } },
    { cap: 'Enc–Dec · cross (타깃 × 소스)', rows: TGT, cols: SRC, mask: function () { return false; } },
    { cap: 'Decoder-only (GPT) · 전체 causal', rows: GPT, cols: GPT, mask: function (i, j) { return j > i; } },
    { cap: 'Prefix LM · 앞 4칸 양방향 + 나머지 causal', rows: GPT, cols: GPT, mask: function (i, j) { return j > i && j >= 4; } }
  ];
  box11.innerHTML = items.map(function (it) { return '<div class="map-cell"><span class="cap">' + it.cap + '</span><div class="scroll-x"></div></div>'; }).join('');
  items.forEach(function (it, i) {
    Lab.matrix(box11.children[i].lastChild, ones(it.rows.length, it.cols.length), { rows: it.rows, cols: it.cols, range: [0, 1.6], values: false, cls: 'xs', cw: '1.5rem', ch: '1.3rem', masked: it.mask });
  });
});
