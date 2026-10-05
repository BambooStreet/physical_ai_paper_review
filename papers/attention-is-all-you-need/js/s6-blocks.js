/* §6 Encoder/Decoder 조립 — 클릭 가능한 Figure 1, 데이터 흐름 애니메이션 */
Lab.section('s6', function () {
  var $ = Lab.$, $$ = Lab.$$, M = Lab.M, fmt = Lab.fmt;
  var svg = $('#s6-fig'), detail = $('#s6-detail'), cap = $('#s6-cap');

  /* ---------- 좌표 ---------- */
  var EX = 210, DX = 550, BW = 190, BH = 34;
  var B = {
    'emb-in':  { x: EX, y: 620, t: 'Input Embedding', c: 'emb' },
    'enc-mha': { x: EX, y: 505, t: 'Multi-Head Attention', c: 'attn' },
    'enc-an1': { x: EX, y: 458, t: 'Add & Norm', c: 'norm' },
    'enc-ffn': { x: EX, y: 395, t: 'Feed Forward', c: 'ffn' },
    'enc-an2': { x: EX, y: 348, t: 'Add & Norm', c: 'norm' },
    'emb-out': { x: DX, y: 620, t: 'Output Embedding', c: 'emb' },
    'dec-mmha': { x: DX, y: 505, t: 'Masked Multi-Head Attention', c: 'attn' },
    'dec-an1': { x: DX, y: 458, t: 'Add & Norm', c: 'norm' },
    'dec-xmha': { x: DX, y: 395, t: 'Multi-Head Attention', c: 'attn' },
    'dec-an2': { x: DX, y: 348, t: 'Add & Norm', c: 'norm' },
    'dec-ffn': { x: DX, y: 285, t: 'Feed Forward', c: 'ffn' },
    'dec-an3': { x: DX, y: 238, t: 'Add & Norm', c: 'norm' },
    'linear':  { x: DX, y: 165, t: 'Linear', c: '' },
    'softmax': { x: DX, y: 112, t: 'Softmax', c: '' }
  };
  function top(k) { return B[k].y; }
  function bot(k) { return B[k].y + BH; }
  function mid(k) { return B[k].y + BH / 2; }

  function arrow(d, cls, id) { return '<path ' + (id ? 'id="' + id + '" ' : '') + 'class="' + (cls || 'wire') + '" d="' + d + '" marker-end="url(#' + (cls === 'wire-x' ? 's6-ahx' : 's6-ah') + ')"/>'; }
  function line(d, cls) { return '<path class="' + (cls || 'wire') + '" d="' + d + '"/>'; }

  var s = '<defs>' +
    '<marker id="s6-ah" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" class="ah"/></marker>' +
    '<marker id="s6-ahx" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" class="ah-x"/></marker>' +
    '</defs>';
  // 프레임
  s += '<rect class="frame" x="' + (EX - 118) + '" y="330" width="236" height="232" rx="10"/>';
  s += '<rect class="frame" x="' + (DX - 118) + '" y="222" width="236" height="340" rx="10"/>';
  s += '<text class="lbl-strong" x="' + (EX - 126) + '" y="450" text-anchor="end">N×</text>';
  s += '<text class="lbl-strong" x="' + (DX + 126) + '" y="396" text-anchor="start">N×</text>';
  // 입력 라벨
  s += '<text class="lbl-strong" x="' + EX + '" y="704" text-anchor="middle">Inputs (소스 문장)</text>';
  s += '<text class="lbl-strong" x="' + DX + '" y="704" text-anchor="middle">Outputs (shifted right)</text>';
  s += '<text class="lbl-strong" x="' + DX + '" y="92" text-anchor="middle">Output Probabilities</text>';
  // PE 원
  [[EX, 'pe-in', EX - 110], [DX, 'pe-out', DX + 110]].forEach(function (p) {
    var cx = p[0], id = p[1], lx = p[2];
    s += '<g class="blk" data-k="' + id + '" tabindex="0" role="button" aria-label="Positional Encoding">' +
      '<circle cx="' + cx + '" cy="590" r="11" style="fill:var(--surface);stroke:var(--ink-2);stroke-width:1.4"/>' +
      '<path d="M' + (cx - 6) + ' 590h12M' + cx + ' 584v12" style="stroke:var(--ink-2);stroke-width:1.6"/>' +
      '<circle cx="' + lx + '" cy="590" r="15" style="fill:var(--surface);stroke:var(--line-strong);stroke-width:1.2"/>' +
      '<path d="M' + (lx - 9) + ' 590q4.5 -10 9 0t9 0" style="fill:none;stroke:var(--c4);stroke-width:1.6"/>' +
      '<rect class="hit" x="' + (Math.min(cx, lx) - 17) + '" y="574" width="' + (Math.abs(cx - lx) + 34) + '" height="32"/>' +
      '</g>';
    s += line('M' + (lx + (cx > lx ? 15 : -15)) + ' 590H' + (cx + (cx > lx ? -11 : 11)), 'wire');
    var left = cx > lx, tx = left ? lx - 21 : lx + 21, anchor = left ? 'end' : 'start';
    s += '<text class="lbl" x="' + tx + '" y="587" text-anchor="' + anchor + '">Positional</text><text class="lbl" x="' + tx + '" y="602" text-anchor="' + anchor + '">Encoding</text>';
  });

  // 인코더 배선
  s += arrow('M' + EX + ' 690V' + (bot('emb-in') + 1));
  s += arrow('M' + EX + ' ' + top('emb-in') + 'V601');
  s += line('M' + EX + ' 579V552');
  s += arrow('M' + (EX - 45) + ' 552V' + (bot('enc-mha') + 1)) + arrow('M' + EX + ' 552V' + (bot('enc-mha') + 1)) + arrow('M' + (EX + 45) + ' 552V' + (bot('enc-mha') + 1));
  s += line('M' + (EX - 45) + ' 552H' + (EX + 45));
  s += arrow('M' + EX + ' ' + top('enc-mha') + 'V' + (bot('enc-an1') + 1));
  s += arrow('M' + EX + ' ' + top('enc-an1') + 'V' + (bot('enc-ffn') + 1));
  s += arrow('M' + EX + ' ' + top('enc-ffn') + 'V' + (bot('enc-an2') + 1));
  // 인코더 잔차 (왼쪽)
  s += arrow('M' + EX + ' 557H' + (EX - 106) + 'V' + mid('enc-an1') + 'H' + (EX - 96), 'wire-res');
  s += arrow('M' + EX + ' 446H' + (EX - 106) + 'V' + mid('enc-an2') + 'H' + (EX - 96), 'wire-res');
  // 디코더 배선
  s += arrow('M' + DX + ' 690V' + (bot('emb-out') + 1));
  s += arrow('M' + DX + ' ' + top('emb-out') + 'V601');
  s += line('M' + DX + ' 579V552');
  s += arrow('M' + (DX - 45) + ' 552V' + (bot('dec-mmha') + 1)) + arrow('M' + DX + ' 552V' + (bot('dec-mmha') + 1)) + arrow('M' + (DX + 45) + ' 552V' + (bot('dec-mmha') + 1));
  s += line('M' + (DX - 45) + ' 552H' + (DX + 45));
  s += arrow('M' + DX + ' ' + top('dec-mmha') + 'V' + (bot('dec-an1') + 1));
  s += arrow('M' + (DX + 30) + ' ' + top('dec-an1') + 'V' + (bot('dec-xmha') + 1));
  s += '<text class="lbl-strong" x="' + (DX + 38) + '" y="446" style="fill:var(--c1)">Q</text>';
  s += arrow('M' + DX + ' ' + top('dec-xmha') + 'V' + (bot('dec-an2') + 1));
  s += arrow('M' + DX + ' ' + top('dec-an2') + 'V' + (bot('dec-ffn') + 1));
  s += arrow('M' + DX + ' ' + top('dec-ffn') + 'V' + (bot('dec-an3') + 1));
  s += arrow('M' + DX + ' ' + top('dec-an3') + 'V' + (bot('linear') + 1));
  s += arrow('M' + DX + ' ' + top('linear') + 'V' + (bot('softmax') + 1));
  s += arrow('M' + DX + ' ' + top('softmax') + 'V' + 100);
  // 디코더 잔차 (오른쪽)
  s += arrow('M' + DX + ' 557H' + (DX + 106) + 'V' + mid('dec-an1') + 'H' + (DX + 96), 'wire-res');
  s += arrow('M' + (DX + 30) + ' 448H' + (DX + 106) + 'V' + mid('dec-an2') + 'H' + (DX + 96), 'wire-res');
  s += arrow('M' + DX + ' 335H' + (DX + 106) + 'V' + mid('dec-an3') + 'H' + (DX + 96), 'wire-res');
  // 인코더 출력 → cross-attention (K, V)
  var xPath = 'M' + EX + ' ' + top('enc-an2') + 'V300H400V' + (mid('dec-xmha') - 6) + 'H' + (DX - 96);
  var xPath2 = 'M400 ' + (mid('dec-xmha') + 6) + 'H' + (DX - 96);
  s += arrow(xPath, 'wire-x');
  s += arrow(xPath2, 'wire-x');
  s += '<text class="lbl-strong" x="408" y="' + (mid('dec-xmha') - 12) + '" style="fill:var(--c2)">K, V</text>';
  s += '<text class="lbl" x="300" y="292" text-anchor="middle">인코더 출력 (memory)</text>';

  // 흐름 애니메이션용 경로
  var FLOWS = {
    src: 'M' + EX + ' 690V552',
    enc: 'M' + EX + ' 552V' + top('enc-an2'),
    mem: xPath,
    mem2: xPath2,
    tgt: 'M' + DX + ' 690V552',
    dec1: 'M' + DX + ' 552V' + top('dec-an1'),
    q: 'M' + (DX + 30) + ' ' + top('dec-an1') + 'V' + bot('dec-xmha'),
    dec2: 'M' + DX + ' ' + top('dec-xmha') + 'V100'
  };
  Object.keys(FLOWS).forEach(function (k) { s += '<path class="flow" data-f="' + k + '" d="' + FLOWS[k] + '"/>'; });

  // 블록
  Object.keys(B).forEach(function (k) {
    var b = B[k];
    s += '<g class="blk ' + b.c + '" data-k="' + k + '" tabindex="0" role="button" aria-label="' + b.t + '">' +
      '<rect x="' + (b.x - BW / 2) + '" y="' + b.y + '" width="' + BW + '" height="' + BH + '" rx="6"/>' +
      '<text x="' + b.x + '" y="' + (b.y + BH / 2 + 4.5) + '" text-anchor="middle">' + b.t + '</text></g>';
  });
  svg.innerHTML = s;

  /* ---------- 상세 패널 ---------- */
  var D = {
    emb: {
      title: 'Embedding', kind: '§3.4 · 토큰 ID → 벡터',
      body: '<p>토큰 ID로 표(V × d<sub>model</sub>)에서 한 행을 꺼냅니다. 논문은 소스 임베딩, 타깃 임베딩, 출력 직전 Linear가 <b>같은 행렬 하나를 공유</b>하고, 임베딩에 √d<sub>model</sub>(≈ 22.6)을 곱합니다.</p>' +
        '<dl><dt>shape</dt><dd>(B, n) → (B, n, 512)</dd><dt>파라미터</dt><dd>37,000 × 512 ≈ 1,894만 (공유라 한 번만)</dd></dl>' +
        '<p class="note">√d<sub>model</sub>을 곱하는 이유를 논문은 설명하지 않습니다. 흔히 공유 가중치의 작은 초기값(≈ 1/√d)을 키워, 크기 ±1인 위치 인코딩에 묻히지 않게 하려는 것으로 해석합니다.</p>'
    },
    pe: {
      title: 'Positional Encoding', kind: '§3.5 · 위치 정보 더하기',
      body: '<p>임베딩에 사인파 위치 벡터를 더합니다. 스택 맨 아래에서 한 번만 더하고, 이후로는 잔차 연결을 따라 위로 전달됩니다. 학습되는 파라미터는 없습니다.</p><p><a href="#s4">§4에서 자세히 →</a></p>'
    },
    'enc-mha': {
      title: '인코더 Self-Attention', kind: '§3.2.3 · Q = K = V = 이전 층 출력',
      body: '<p>소스 문장의 모든 토큰이 서로를 봅니다. padding mask 외에는 가리는 칸이 없습니다(양방향).</p>' +
        '<dl><dt>attention 행렬</dt><dd>(B, h, n_src, n_src)</dd><dt>파라미터</dt><dd>4 × (512² + 512) = 1,050,624</dd></dl>' +
        '<p><a href="#s2">§2 계산</a> · <a href="#s5">§5 multi-head</a></p>'
    },
    'dec-mmha': {
      title: '디코더 Masked Self-Attention', kind: '§3.2.3 · causal mask',
      body: '<p>타깃 문장 안에서 self-attention을 하되, 위치 i는 1…i만 봅니다. 학습 때 정답 문장 전체를 넣어도 미래를 커닝하지 않습니다.</p>' +
        '<dl><dt>attention 행렬</dt><dd>(B, h, n_tgt, n_tgt), 위 삼각형 = −∞</dd><dt>파라미터</dt><dd>1,050,624</dd></dl><p><a href="#s3">§3 Masking →</a></p>'
    },
    'dec-xmha': {
      title: 'Cross-Attention (encoder–decoder)', kind: '§3.2.3 · Q는 디코더, K·V는 인코더',
      body: '<p>디코더가 "지금 무엇을 만들 차례인지"를 Query로 묻고, 인코더 최종 출력(memory)에서 Key로 찾아 Value를 가져옵니다. 번역의 단어 정렬(alignment)이 여기서 일어납니다.</p>' +
        '<dl><dt>Q</dt><dd>(B, h, n_tgt, d_k) ← 디코더</dd><dt>K, V</dt><dd>(B, h, n_src, d_k) ← 인코더</dd><dt>attention 행렬</dt><dd>(B, h, n_tgt, n_src) 직사각형</dd><dt>파라미터</dt><dd>1,050,624</dd></dl>' +
        '<p class="note">memory는 인코더 마지막 층의 출력 하나이고, 디코더 N개 층 모두가 같은 memory를 봅니다. 추론 때 인코더는 한 번만 실행합니다.</p>'
    },
    norm: {
      title: 'Add & Norm', kind: '§3.1 · 잔차 연결 + LayerNorm',
      body: '<div class="eq">\\[\\mathrm{LayerNorm}(x+\\mathrm{Sublayer}(x))\\]</div>' +
        '<p>서브레이어 출력을 입력에 더한 뒤(잔차), 토큰 벡터마다 평균 0·분산 1로 정규화하고 γ, β로 다시 스케일합니다. 배치가 아니라 <b>특징 축</b>으로 정규화하므로 길이가 달라도, 배치가 1이어도 동작합니다.</p>' +
        '<div class="controls" style="margin:10px 0 8px"><span class="ctl">순서 <span id="s6-ln-seg"></span></span><button class="btn small" type="button" id="s6-ln-new">다른 입력</button></div>' +
        '<div class="vec-rows" id="s6-ln-rows"></div><p class="note" id="s6-ln-note"></p>'
    },
    ffn: {
      title: 'Position-wise Feed-Forward', kind: '§3.3 · 512 → 2048 → 512',
      body: '<div class="eq">\\[\\mathrm{FFN}(x)=\\max(0,\\,xW_1+b_1)\\,W_2+b_2\\]</div>' +
        '<p>토큰마다 따로, 그러나 <b>모든 위치에 같은 가중치</b>로 적용합니다. 4배로 넓혔다가 ReLU를 거쳐 다시 좁힙니다. attention이 토큰 사이에서 정보를 섞는다면, FFN은 토큰 하나 안에서 특징을 가공합니다.</p>' +
        '<dl><dt>W₁, b₁</dt><dd>512 × 2048 + 2048</dd><dt>W₂, b₂</dt><dd>2048 × 512 + 512</dd><dt>층당 파라미터</dt><dd>2,099,712 (attention의 2배)</dd></dl>' +
        '<p style="margin:12px 0 6px"><b>축소판으로 계산해 보기</b> · 4 → 16 → 4 <button class="btn small" type="button" id="s6-ffn-new" style="margin-left:8px">다른 입력</button></p>' +
        '<div class="vec-rows" id="s6-ffn-rows"></div><p class="note" id="s6-ffn-note"></p>'
    },
    linear: {
      title: 'Linear + Softmax', kind: '§3.4 · d_model → 어휘 확률',
      body: '<p>디코더 마지막 출력(512차원)에 임베딩 행렬의 전치(512 × V)를 곱해 어휘 크기의 로짓을 만들고, softmax로 다음 토큰 확률을 냅니다. 임베딩과 가중치를 공유하므로 "출력 벡터와 가장 비슷한 임베딩을 가진 토큰"이 높은 점수를 받습니다.</p>' +
        '<dl><dt>로짓</dt><dd>(B, n_tgt, 37000)</dd><dt>추가 파라미터</dt><dd>0 (공유)</dd></dl><p><a href="#s8">§8 추론에서 이 확률을 쓰는 방법 →</a></p>'
    }
  };
  var KEYMAP = { 'emb-in': 'emb', 'emb-out': 'emb', 'pe-in': 'pe', 'pe-out': 'pe', 'enc-an1': 'norm', 'enc-an2': 'norm', 'dec-an1': 'norm', 'dec-an2': 'norm', 'dec-an3': 'norm', 'enc-ffn': 'ffn', 'dec-ffn': 'ffn', 'softmax': 'linear' };

  function select(k) {
    $$('.blk', svg).forEach(function (g) { g.classList.toggle('sel', g.dataset.k === k); });
    var key = KEYMAP[k] || k, d = D[key];
    detail.innerHTML = '<span class="kind">' + d.kind + '</span><h4>' + d.title + '</h4>' + d.body;
    if (key === 'norm') initLN();
    if (key === 'ffn') initFFN();
    Lab.typeset(detail);
  }
  svg.addEventListener('click', function (e) { var g = e.target.closest('.blk'); if (g) select(g.dataset.k); });
  svg.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var g = e.target.closest('.blk'); if (g) { e.preventDefault(); select(g.dataset.k); }
  });

  /* Add & Norm 미니 계산 */
  var lnMode = 'post', lnSeed = 3;
  function layerNorm(v) {
    var mu = v.reduce(function (a, b) { return a + b; }, 0) / v.length;
    var va = v.reduce(function (a, b) { return a + (b - mu) * (b - mu); }, 0) / v.length;
    var sd = Math.sqrt(va + 1e-5);
    return { y: v.map(function (x) { return (x - mu) / sd; }), mu: mu, sd: sd };
  }
  function vrow(label, v, side) {
    var tmp = document.createElement('div');
    Lab.matrix(tmp, [v], { mode: 'div', range: [-3, 3], digits: 2, cls: 'vec' });
    return '<span class="lab-n">' + label + '</span><div class="scroll-x">' + tmp.innerHTML + (side ? '<div class="side">' + side + '</div>' : '') + '</div>';
  }
  function initLN() {
    var seg = $('#s6-ln-seg');
    if (!seg) return;
    Lab.seg(seg, [{ v: 'post', label: 'Post-LN (논문)' }, { v: 'pre', label: 'Pre-LN' }], lnMode, function (v) { lnMode = v; drawLN(); });
    $('#s6-ln-new').onclick = function () { lnSeed++; drawLN(); };
    drawLN();
  }
  function drawLN() {
    var r = Lab.rng(lnSeed * 97);
    var x = []; for (var i = 0; i < 6; i++) x.push(+(Lab.gauss(r) * 1.2 + 0.4).toFixed(2));
    var W = Lab.randMat(6, 6, Lab.rng(5), 0.6);
    var F = function (v) { return M.mul([v], W)[0]; };
    var h = '';
    if (lnMode === 'post') {
      var fx = F(x), sum = x.map(function (v, i) { return v + fx[i]; }), n = layerNorm(sum);
      h += vrow('x (입력)', x) + vrow('Sublayer(x)', fx) + vrow('x + Sublayer(x)', sum, 'μ = ' + fmt(n.mu, 2) + ', σ = ' + fmt(n.sd, 2)) + vrow('LayerNorm(…)', n.y, '평균 0, 분산 1 (γ = 1, β = 0)');
      $('#s6-ln-note').textContent = 'Post-LN: 출력이 항상 정규화되어 크기가 일정합니다. 대신 잔차 경로 자체가 층마다 LayerNorm을 통과합니다.';
    } else {
      var nx = layerNorm(x), fx2 = F(nx.y), out = x.map(function (v, i) { return v + fx2[i]; });
      h += vrow('x (입력)', x) + vrow('LayerNorm(x)', nx.y) + vrow('Sublayer(LN(x))', fx2) + vrow('x + Sublayer(LN(x))', out, '정규화되지 않은 채 다음 층으로');
      $('#s6-ln-note').textContent = 'Pre-LN: x가 아무 변형 없이 출력에 더해지는 "깨끗한" 잔차 경로가 남습니다. 깊은 모델에서 학습이 안정적이라 GPT-2 이후 표준이 되었습니다(§11).';
    }
    $('#s6-ln-rows').innerHTML = h;
  }

  /* FFN 미니 계산 */
  var ffnSeed = 1;
  var W1 = Lab.randMat(4, 16, Lab.rng(41), 0.7), b1 = Lab.randMat(1, 16, Lab.rng(42), 0.3)[0];
  var W2 = Lab.randMat(16, 4, Lab.rng(43), 0.35), b2 = [0.1, -0.1, 0, 0.05];
  function initFFN() {
    if (!$('#s6-ffn-new')) return;
    $('#s6-ffn-new').onclick = function () { ffnSeed++; drawFFN(); };
    drawFFN();
  }
  function drawFFN() {
    var r = Lab.rng(ffnSeed * 13);
    var x = [0, 1, 2, 3].map(function () { return +(Lab.gauss(r)).toFixed(2); });
    var pre = M.mul([x], W1)[0].map(function (v, i) { return v + b1[i]; });
    var hdd = pre.map(function (v) { return Math.max(0, v); });
    var y = M.mul([hdd], W2)[0].map(function (v, i) { return v + b2[i]; });
    var active = hdd.filter(function (v) { return v > 0; }).length;
    var tmp = document.createElement('div');
    Lab.matrix(tmp, [hdd], { mode: 'div', range: [-3, 3], digits: 1, cls: 'xs', values: false, masked: function (i, j) { return hdd[j] === 0; } });
    var tmp2 = document.createElement('div');
    Lab.matrix(tmp2, [pre], { mode: 'div', range: [-3, 3], values: false, cls: 'xs' });
    $('#s6-ffn-rows').innerHTML = vrow('x (4)', x) +
      '<span class="lab-n">xW₁ + b₁ (16)</span><div class="scroll-x">' + tmp2.innerHTML + '</div>' +
      '<span class="lab-n">ReLU (16)</span><div class="scroll-x">' + tmp.innerHTML + '<div class="side">빗금 = 0으로 잘린 유닛</div></div>' +
      vrow('출력 (4)', y);
    $('#s6-ffn-note').textContent = '16개 중 ' + active + '개 유닛만 켜졌습니다. 입력마다 다른 유닛 조합이 켜지는 것이 FFN의 비선형성입니다. 실제 모델은 2048개 중 일부가 켜집니다.';
  }

  /* ---------- 데이터 흐름 재생 ---------- */
  var PHASES = [
    { cap: '① 소스 문장을 임베딩하고 위치 인코딩을 더합니다.', hl: ['emb-in', 'pe-in'], f: ['src'] },
    { cap: '② 인코더 층을 N번 통과합니다. 모든 소스 토큰이 서로를 봅니다(self-attention → FFN).', hl: ['enc-mha', 'enc-an1', 'enc-ffn', 'enc-an2'], f: ['enc'] },
    { cap: '③ 인코더 최종 출력(memory)이 디코더 모든 층의 cross-attention으로 가서 K와 V가 됩니다. 인코더는 여기서 할 일이 끝납니다.', hl: ['dec-xmha'], f: ['mem', 'mem2'] },
    { cap: '④ 디코더 입력(한 칸 밀린 정답, 또는 추론 때 지금까지 생성한 토큰)이 masked self-attention을 거칩니다.', hl: ['emb-out', 'pe-out', 'dec-mmha', 'dec-an1'], f: ['tgt', 'dec1'] },
    { cap: '⑤ 그 결과가 Query가 되어 인코더의 K·V와 만납니다. 디코더 위치마다 소스 문장의 어디를 볼지 정합니다.', hl: ['dec-xmha'], f: ['q', 'mem', 'mem2'] },
    { cap: '⑥ FFN을 거쳐 Linear → Softmax로 다음 토큰 확률을 냅니다. 추론 때는 고른 토큰을 ④의 입력 끝에 붙여 반복합니다.', hl: ['dec-an2', 'dec-ffn', 'dec-an3', 'linear', 'softmax'], f: ['dec2'] }
  ];
  var timer = null, ph = -1;
  var playBtn = $('#s6-play'), stopBtn = $('#s6-stop');
  function showPhase(i) {
    $$('.blk', svg).forEach(function (g) { g.classList.remove('hl'); });
    $$('.flow', svg).forEach(function (p) { p.classList.remove('on'); });
    if (i < 0) return;
    var p = PHASES[i];
    p.hl.forEach(function (k) { var g = svg.querySelector('[data-k="' + k + '"]'); if (g) g.classList.add('hl'); });
    p.f.forEach(function (k) { var e = svg.querySelector('[data-f="' + k + '"]'); if (e) e.classList.add('on'); });
    cap.textContent = p.cap;
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null; ph = -1;
    showPhase(-1);
    playBtn.hidden = false; stopBtn.hidden = true;
  }
  playBtn.addEventListener('click', function () {
    stop();
    ph = 0; showPhase(0);
    playBtn.hidden = true; stopBtn.hidden = false;
    timer = setInterval(function () {
      ph++;
      if (ph >= PHASES.length) { stop(); cap.textContent = '한 번의 번역 흐름이 끝났습니다. 블록을 눌러 각 연산을 자세히 보세요.'; return; }
      showPhase(ph);
    }, 2600);
  });
  stopBtn.addEventListener('click', function () { stop(); cap.textContent = '블록을 눌러 보세요.'; });

  select('dec-xmha');
  cap.textContent = '블록을 눌러 보세요. 지금은 cross-attention이 선택되어 있습니다.';
});
