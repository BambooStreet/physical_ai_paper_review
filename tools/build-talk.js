/* ==========================================================================
   발표용 페이지 생성기
   papers/attention-is-all-you-need/index.html(전체 실습)을 읽어
   논문 3장 순서의 발표 페이지 presentation.html을 만든다.

     node tools/build-talk.js

   발표 순서 (논문 섹션)
     Part 1 Background            §1·§2   ← 원본 §1
     Part 2 인코더·디코더 구조      §3.1    ← 원본 §6
     Part 3 Attention             §3.2    ← 원본 §2, §5, §3
     Part 4 Position-wise FFN     §3.3    ← 새로 작성
     Part 5 Embeddings·Softmax+PE §3.4–5  ← 새로 작성 + 원본 §4
     Part 6 정리: Why Self-Attention §4   ← 원본 §1의 Table 1 실험

   presentation.html을 직접 고치면 다음 생성 때 덮어써지므로,
   공통 내용은 index.html을, 발표 전용 문구는 이 파일을 고친다.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'papers', 'attention-is-all-you-need');
const SRC = path.join(DIR, 'index.html');
const OUT = path.join(DIR, 'presentation.html');
const src = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');

function must(cond, msg) { if (!cond) throw new Error('생성 실패: ' + msg); }
function between(s, a, b, from) {
  const i = s.indexOf(a, from || 0);
  must(i >= 0, '찾을 수 없음: ' + a.slice(0, 60));
  const j = s.indexOf(b, i + a.length);
  must(j >= 0, '찾을 수 없음: ' + b.slice(0, 60));
  return [i, j];
}
function rep(s, a, b) { must(s.includes(a), '치환 대상 없음: ' + a.slice(0, 70)); return s.split(a).join(b); }

/* ---------- 원본에서 조각 꺼내기 ---------- */
const sections = {};
for (const m of src.matchAll(/<section class="sec" id="(s\d+)">[\s\S]*?<\/section>/g)) sections[m[1]] = m[0];
['s1', 's2', 's3', 's4', 's5', 's6'].forEach(id => must(sections[id], id + ' 섹션 없음'));

const [hs, he] = between(src, '<header class="hero" id="top">', '</header>');
let hero = src.slice(hs, he + '</header>'.length);
const headEnd = src.indexOf('</head>');
let head = src.slice(0, headEnd);
const scriptTags = [...src.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);

/* ---------- 번호 바꾸기 ---------- */
// 원본 섹션 번호 → 발표 페이지 번호
const SEC = { 1: '1', 2: '3.1', 3: '3.3', 4: '5.2', 5: '3.2', 6: '2' };
// 원본 실험 번호 → 발표 페이지 실험 번호
const LAB = {
  '1-1': '1-1', '1-2': '6-1', '6-1': '2-1',
  '2-1': '3-1', '2-2': '3-2', '5-1': '3-3', '5-2': '3-4', '5-3': '3-5',
  '3-1': '3-6', '3-2': '3-7', '3-3': '3-8',
  '4-1': '5-1', '4-2': '5-2', '4-3': '5-3'
};
function relabel(html) {
  // 논문 절 번호(§3.2.1, §1 Introduction 등)가 있는 곳은 건드리지 않는다
  const keep = [];
  html = html.replace(/<p class="sec-eyebrow">[\s\S]*?<\/p>|<aside class="paper-ref">[\s\S]*?<\/aside>|<p class="ctx-[\s\S]*?<\/p>/g, m => { keep.push(m); return '\u0000' + (keep.length - 1) + '\u0000'; });
  html = html.replace(/실험 (\d+-\d+)/g, (m, k) => '실험 ' + (LAB[k] || k));
  html = html.replace(/href="#s(7|8|9|10|11)"/g, 'href="index.html#s$1"');
  html = html.replace(/§(\d+)(?![.\d])/g, (m, n) => SEC[n] ? SEC[n] : '전체 실습 §' + n);
  return html.replace(/\u0000(\d+)\u0000/g, (m, i) => keep[+i]);
}
function setNum(html, n) { return html.replace(/<div class="sec-num">\d+<\/div>/, '<div class="sec-num">' + n + '</div>'); }
function setNext(html, href, label) {
  return html.replace(/<a class="next" href="[^"]*">[^<]*<\/a>/, '<a class="next" href="' + href + '">다음: ' + label + ' →</a>');
}

/* ---------- Part 1: Background (원본 §1에서 Table 1 실험과 결과 상자는 Part 6으로) ---------- */
let p1 = sections.s1;
const [t1s] = between(p1, '<div class="predict">', '</div>');
const [cs, ce] = between(p1, '<div class="callout">', '</div>');
const table1Block = p1.slice(t1s, cs);                       // 예측 상자 + 실험 1-2
const resultCallout = p1.slice(cs, ce + '</div>'.length);    // "그래서 결과는?"
p1 = p1.slice(0, t1s) + p1.slice(ce + '</div>'.length);
const [r1s, r1e] = between(p1, '<p class="ref-sec">§4 Why Self-Attention</p>', '</aside>');
const ref4 = p1.slice(r1s, r1e);
p1 = p1.slice(0, r1s) + p1.slice(r1e);
p1 = rep(p1, '<p class="sec-eyebrow">§1 Introduction · §4 Why Self-Attention · Table 1</p>', '<p class="sec-eyebrow">§1 Introduction · §2 Background</p>');
p1 = rep(p1, '<h2>출발점: 왜 RNN을 버렸나</h2>', '<h2>Background: 왜 RNN을 버렸나</h2>');
p1 = rep(p1, '논문 4장은 이 trade-off를 세 가지 기준으로 비교합니다.', '이 trade-off를 숫자로 비교한 논문 4장의 표는 Part 6에서 다시 봅니다.');
p1 = setNext(relabel(setNum(p1, '1')), '#s6', '인코더·디코더 구조');

/* ---------- Part 2: 인코더·디코더 구조 (원본 §6) ---------- */
let p2 = sections.s6;
p2 = rep(p2, '<p class="sec-eyebrow">§3.1 · §3.2.3 · §3.3 · §3.4 · Figure 1</p>', '<p class="sec-eyebrow">§3.1 Encoder and Decoder Stacks · Figure 1</p>');
p2 = rep(p2, '<h2>Encoder·Decoder 블록 조립</h2>', '<h2>인코더·디코더 구조</h2>');
p2 = rep(p2, '<p class="lede">지금까지 본 부품을 Figure 1처럼 조립합니다. 블록을 누르면 그 연산이 펼쳐집니다.</p>',
  '<p class="lede">논문 3장처럼 전체 구조부터 봅니다. 각 부품은 Part 3부터 하나씩 자세히 살펴봅니다. 블록을 누르면 그 연산이 펼쳐집니다.</p>');
p2 = setNext(relabel(setNum(p2, '2')), '#s2', 'Attention');

/* ---------- Part 3: Attention (원본 §2 → §5 → §3) ---------- */
const p31 = setNext(relabel(setNum(sections.s2, '3.1')), '#s5', 'Multi-Head Attention');
const p32 = setNext(relabel(setNum(sections.s5, '3.2')), '#s3', 'Masking과 attention의 세 가지 쓰임');
let p33 = sections.s3;
p33 = p33.replace(/<p class="sec-eyebrow">([^<]*)<\/p>/, '<p class="sec-eyebrow">§3.2.3 Applications of Attention · $1</p>');
p33 = setNext(relabel(setNum(p33, '3.3')), '#ffn', 'Position-wise Feed-Forward');
const appsBox = `
          <div class="callout">
            <b>논문 §3.2.3: attention이 쓰이는 세 곳</b>
            <ul style="margin:6px 0 0;padding-left:1.2em">
              <li><b>인코더 self-attention</b>: 입력 문장의 단어끼리 서로 봅니다(가리는 칸 없음).</li>
              <li><b>디코더 masked self-attention</b>: 이미 만든 앞쪽 단어만 봅니다. 아래 실험의 causal mask가 이것입니다.</li>
              <li><b>Cross-attention</b>: 디코더가 Query, 인코더 출력이 Key·Value입니다. Part 2 그림의 가운데 블록입니다.</li>
            </ul>
          </div>
`;
const p33b = p33.replace('<div class="sec-main">', '<div class="sec-main">' + appsBox);

/* ---------- Part 4: Position-wise FFN (새로 작성) ---------- */
const p4 = `
    <section class="sec" id="ffn">
      <header class="sec-head">
        <div class="sec-num">4</div>
        <div>
          <p class="sec-eyebrow">§3.3 Position-wise Feed-Forward Networks</p>
          <h2>Position-wise Feed-Forward</h2>
          <p class="lede">attention이 단어 <b>사이</b>에서 정보를 섞는다면, FFN은 단어 <b>하나하나</b>의 벡터를 따로 가공합니다.</p>
        </div>
      </header>
      <div class="sec-body">
        <div class="sec-main">
          <div class="prose">
            <p>attention 서브레이어 바로 뒤에는 작은 신경망(FFN)이 붙습니다. 512차원 벡터를 2048차원으로 넓혔다가 ReLU를 거쳐 다시 512차원으로 줄입니다. "position-wise"라는 이름은 <b>모든 위치(단어)에 같은 가중치를 각각 따로</b> 적용한다는 뜻입니다. 단어끼리 정보를 주고받는 일은 attention이 이미 했으니, FFN은 모은 정보를 단어마다 한 번 더 가공합니다.</p>
          </div>
          <figure class="intro-fig" style="max-width:560px;margin-top:0">
            <svg viewBox="0 0 560 150" role="img" aria-label="FFN: 512차원 → 2048차원(ReLU) → 512차원">
              <g class="ia-box"><rect x="20" y="45" width="90" height="60" rx="6"/><rect x="420" y="45" width="90" height="60" rx="6"/></g>
              <g class="ia-box ia-on"><rect x="175" y="10" width="180" height="130" rx="6"/></g>
              <g class="ia-chain"><path d="M112 75H170"/><path d="M358 75H416"/></g>
              <g class="ia-word"><text x="65" y="80">512</text><text x="265" y="70">2048</text><text x="265" y="92" style="font-size:12px">ReLU</text><text x="465" y="80">512</text></g>
              <text class="ia-note" x="141" y="68" text-anchor="middle">W₁</text><text class="ia-note" x="387" y="68" text-anchor="middle">W₂</text>
            </svg>
            <figcaption>단어 벡터 하나가 지나가는 길. 모든 단어가 같은 W₁, W₂를 씁니다.</figcaption>
          </figure>
          <div class="callout"><b>숫자로 보면</b> 층마다 FFN 파라미터는 약 210만 개로, 같은 층의 attention(약 105만 개)의 두 배입니다. base 모델 전체로는 파라미터의 약 40%가 FFN에 있습니다. 이름은 "Attention Is All You Need"지만 가장 큰 몫은 FFN입니다.</div>
          <div class="btn-row"><button class="btn" type="button" data-fig-open="enc-ffn">Part 2 그림에서 FFN 축소판 계산 보기 ↑</button></div>
        </div>
        <aside class="paper-ref">
          <div class="ref-label">원문 대조 <a href="https://arxiv.org/abs/1706.03762" target="_blank" rel="noopener">arXiv ↗</a></div>
          <p class="ref-sec">§3.3 Position-wise FFN</p>
          <div class="eq">\\[\\mathrm{FFN}(x)=\\max(0,\\,xW_1+b_1)\\,W_2+b_2\\]</div>
          <p>위치마다 같은 선형 변환을 쓰지만 층마다 파라미터는 다릅니다. 커널 크기 1인 합성곱 두 개로 볼 수도 있습니다. 입력·출력 차원 d<sub>model</sub> = 512, 내부 차원 d<sub>ff</sub> = 2048.</p>
        </aside>
      </div>
      <footer class="sec-foot">
        <label class="done-check"><input type="checkbox" data-done="ffn"> 이 섹션을 이해했어요</label>
        <a class="next" href="#emb">다음: Embeddings와 Softmax →</a>
      </footer>
    </section>
`;

/* ---------- Part 5: Embeddings·Softmax (새로 작성) + Positional Encoding (원본 §4) ---------- */
const p51 = `
    <section class="sec" id="emb">
      <header class="sec-head">
        <div class="sec-num">5.1</div>
        <div>
          <p class="sec-eyebrow">§3.4 Embeddings and Softmax</p>
          <h2>Embeddings와 Softmax: 단어 ↔ 벡터</h2>
          <p class="lede">모델의 입구에서는 단어를 벡터로 바꾸고, 출구에서는 벡터를 다시 단어 확률로 바꿉니다.</p>
        </div>
      </header>
      <div class="sec-body">
        <div class="sec-main">
          <div class="prose">
            <p><b>입구 (Embedding)</b>: 단어마다 번호가 있고, 37,000 × 512 크기의 표에서 그 번호의 행을 꺼내면 512차원 벡터가 됩니다. 논문은 이 벡터에 √d<sub>model</sub>(≈ 22.6)을 곱해서 씁니다.</p>
            <p><b>출구 (Linear + Softmax)</b>: 디코더의 마지막 벡터를 같은 표의 모든 단어 벡터와 비교해 단어마다 점수(로짓)를 매기고, softmax로 확률로 바꿉니다. 가장 확률이 높은 단어가 다음 단어 후보가 됩니다.</p>
            <p>논문은 입력 임베딩, 출력 임베딩, softmax 직전 Linear 세 곳이 <b>같은 표 하나를 공유</b>하게 했습니다. "이 벡터와 가장 닮은 단어"를 고르는 셈이고, 표를 따로 둘 때보다 파라미터도 약 3,800만 개(2 × 37,000 × 512) 아낍니다.</p>
          </div>
          <div class="btn-row"><button class="btn" type="button" data-fig-open="emb-in">Part 2 그림에서 Embedding 보기 ↑</button><button class="btn" type="button" data-fig-open="linear">Linear + Softmax 보기 ↑</button></div>
          <div class="callout">그런데 임베딩 표에는 <b>단어 정보만</b> 있고 "몇 번째 단어인지"는 없습니다. attention도 순서를 보지 않으니, 위치 정보를 따로 더해야 합니다. 그것이 바로 다음 5.2입니다.</div>
        </div>
        <aside class="paper-ref">
          <div class="ref-label">원문 대조 <a href="https://arxiv.org/abs/1706.03762" target="_blank" rel="noopener">arXiv ↗</a></div>
          <p class="ref-sec">§3.4 Embeddings and Softmax</p>
          <p>학습된 임베딩으로 입력·출력 토큰을 d<sub>model</sub>차원 벡터로 바꾸고, 디코더 출력은 학습된 선형 변환과 softmax로 다음 토큰 확률이 됩니다. 두 임베딩 층과 softmax 직전 선형 변환이 같은 가중치 행렬을 공유하고, 임베딩 층에서는 가중치에 √d<sub>model</sub>을 곱합니다.</p>
        </aside>
      </div>
      <footer class="sec-foot">
        <label class="done-check"><input type="checkbox" data-done="emb"> 이 섹션을 이해했어요</label>
        <a class="next" href="#s4">다음: Positional Encoding →</a>
      </footer>
    </section>
`;
const p52 = setNext(relabel(setNum(sections.s4, '5.2')), '#why', '정리: 왜 self-attention인가');

/* ---------- Part 6: 정리 (원본 §1의 Table 1 실험 + 결과) ---------- */
const p6 = `
    <section class="sec" id="why">
      <header class="sec-head">
        <div class="sec-num">6</div>
        <div>
          <p class="sec-eyebrow">§4 Why Self-Attention · Table 1</p>
          <h2>정리: 왜 self-attention인가</h2>
          <p class="lede">논문 4장은 self-attention을 RNN·CNN과 세 가지 기준으로 비교하며 마무리합니다.</p>
        </div>
      </header>
      <div class="sec-body">
        <div class="sec-main">
          <div class="prose">
            <p>층 하나의 연산량, 순서대로 해야 하는 계산 수, 먼 단어까지의 경로 길이. Part 1에서 그림으로 본 두 가지 문제(병렬화, 경로 길이)를 숫자로 확인하는 표입니다.</p>
          </div>
${relabel(table1Block)}
          ${resultCallout}
          <div class="callout">
            <b>오늘 본 것 한 줄씩</b>
            <ul style="margin:6px 0 0;padding-left:1.2em">
              <li><b>Self-attention</b>: 모든 단어가 서로를 한 번에 직접 참고합니다(Part 3).</li>
              <li><b>구조</b>: attention + FFN 블록을 쌓은 인코더와 디코더, 그 사이를 잇는 cross-attention(Part 2, 4).</li>
              <li><b>위치 인코딩</b>: 순서를 모르는 attention에 위치 정보를 더해 줍니다(Part 5).</li>
            </ul>
            <p style="margin:8px 0 0">학습 방법, 추론(beam search), 브라우저에서 직접 학습시키기는 <a href="index.html#s7">전체 실습 페이지</a>에 있습니다.</p>
          </div>
        </div>
        <aside class="paper-ref">
          <div class="ref-label">원문 대조 <a href="https://arxiv.org/abs/1706.03762" target="_blank" rel="noopener">arXiv ↗</a></div>
          ${ref4}</aside>
      </div>
      <footer class="sec-foot">
        <label class="done-check"><input type="checkbox" data-done="why"> 이 섹션을 이해했어요</label>
        <a class="next" href="#top">맨 위로 ↑</a>
      </footer>
    </section>
`;

/* ---------- 파트 구분 띠 ---------- */
function band(n, title, paper, mins, items) {
  return `
    <div class="part-band" id="part${n}">
      <span class="part-n">PART ${n}</span>
      <span class="part-t">${title}</span>
      <span class="part-m">논문 ${paper} · 약 ${mins}분</span>
      ${items ? '<span class="part-i">' + items + '</span>' : ''}
    </div>
`;
}

/* ---------- 들어가며(0) 손질: 구조도 링크·안내를 발표 번호로 ---------- */
const MAPLINK = [
  ['<a href="#s4"><g class="mb emb">', '<a href="#emb"><g class="mb emb">'],
  ['>§4</text>', '>5</text>'],
  ['>§2 · §5</text>', '>3.1 · 3.2</text>'],
  ['<a href="#s6"><g class="mb ffn"><rect x="75"', '<a href="#ffn"><g class="mb ffn"><rect x="75"'],
  ['<a href="#s6"><g class="mb ffn"><rect x="365"', '<a href="#ffn"><g class="mb ffn"><rect x="365"'],
  ['<a href="#s8"><g class="mb out">', '<a href="#emb"><g class="mb out">'],
  ['>§8</text>', '>5.1</text>'],
  ['<text class="mb-s" x="557" y="221">§3</text>', '<text class="mb-s" x="557" y="221">3.3</text>'],
  ['<text class="mb-s" x="557" y="167">§6</text></g></a>\n          <a href="#ffn">', '<text class="mb-s" x="557" y="167">2 · 3.3</text></g></a>\n          <a href="#ffn">']
];
for (const [a, b] of MAPLINK) hero = hero.split(a).join(b);
hero = hero.replace(/<text class="mb-s" x="(267|557)" y="(167|107)">§6<\/text>/g, '<text class="mb-s" x="$1" y="$2">4</text>');
must(!/>§\d/.test(hero.slice(hero.indexOf('<svg class="map-svg"'), hero.indexOf('</svg>', hero.indexOf('<svg class="map-svg"')))), '구조도에 원본 번호가 남음');
hero = rep(hero, '<p class="eyebrow">실습 01 · Vaswani et al. · NeurIPS 2017 · arXiv 1706.03762</p>', '<p class="eyebrow">발표용 · Vaswani et al. · NeurIPS 2017 · arXiv 1706.03762</p>');
hero = hero.replace(/<p class="hint" style="margin-top:6px">[^<]*<\/p>/, '<p class="hint" style="margin-top:6px">블록을 누르면 해당 파트로 이동합니다. 잔차 연결, LayerNorm 같은 세부 구조는 Part 2에서 다룹니다.</p>');
hero = hero.replace(/<p class="intro-close">[^<]*<\/p>/, '<p class="intro-close">아래에서는 논문 3장의 순서대로 전체 구조를 먼저 보고(Part 2), 부품을 하나씩 살펴봅니다.</p>');
hero = hero.replace(/<div class="route">[\s\S]*?<\/div>/, `<div class="route">
        <p><b>발표 순서</b> <a href="#part1">1 Background</a> → <a href="#part2">2 인코더·디코더 구조</a> → <a href="#part3">3 Attention</a> → <a href="#part4">4 FFN</a> → <a href="#part5">5 Embeddings · 위치 인코딩</a> → <a href="#part6">6 정리</a></p>
        <p class="hint">이 페이지는 발표용으로 다시 배치한 버전입니다. 학습·추론·직접 학습 실습까지 모두 보려면 <a href="index.html">전체 실습 페이지</a>로 가세요.</p>
      </div>`);

/* ---------- 머리말·목차 ---------- */
head = rep(head, '<title>Attention Is All You Need 실습</title>', '<title>Attention Is All You Need 발표</title>');
const toc = `
  <nav class="toc" aria-label="목차">
    <p class="toc-title">발표 순서 <span id="toc-count">0 / 9</span></p>
    <ol>
      <li><a href="#top" data-sec="top"><span class="n">0</span><span>들어가며</span><span></span></a></li>
      <li><a href="#s1" data-sec="s1"><span class="n">1</span><span>Background</span><span class="ck"></span></a></li>
      <li><a href="#s6" data-sec="s6"><span class="n">2</span><span>인코더·디코더 구조</span><span class="ck"></span></a></li>
      <li class="toc-part"><span class="n">3</span><span>Attention</span></li>
      <li class="toc-sub"><a href="#s2" data-sec="s2"><span class="n">3.1</span><span>Scaled Dot-Product</span><span class="ck"></span></a></li>
      <li class="toc-sub"><a href="#s5" data-sec="s5"><span class="n">3.2</span><span>Multi-Head</span><span class="ck"></span></a></li>
      <li class="toc-sub"><a href="#s3" data-sec="s3"><span class="n">3.3</span><span>Masking · 세 가지 쓰임</span><span class="ck"></span></a></li>
      <li><a href="#ffn" data-sec="ffn"><span class="n">4</span><span>Feed-Forward</span><span class="ck"></span></a></li>
      <li class="toc-part"><span class="n">5</span><span>입력과 출력</span></li>
      <li class="toc-sub"><a href="#emb" data-sec="emb"><span class="n">5.1</span><span>Embeddings · Softmax</span><span class="ck"></span></a></li>
      <li class="toc-sub"><a href="#s4" data-sec="s4"><span class="n">5.2</span><span>Positional Encoding</span><span class="ck"></span></a></li>
      <li><a href="#why" data-sec="why"><span class="n">6</span><span>정리</span><span class="ck"></span></a></li>
    </ol>
    <div class="toc-foot"><a href="index.html">전체 실습 페이지</a>로 · 원문 <a href="https://arxiv.org/abs/1706.03762" target="_blank" rel="noopener">arXiv</a></div>
  </nav>
`;
const [ts, te] = between(src, '<nav class="toc"', '</nav>');
let top = src.slice(src.indexOf('<body>'), ts) + toc.trim() + src.slice(te + '</nav>'.length, hs);
top = rep(top, '<span class="crumb">/ <b>Attention Is All You Need</b></span>', '<span class="crumb">/ <a href="index.html">Attention Is All You Need</a> / <b>발표</b></span>');

/* ---------- 스크립트 ---------- */
const keepJs = scriptTags.filter(s => /site\.js|lab-core\.js|s[1-6]-[a-z]+\.js/.test(s));
must(keepJs.length === 8, '필요한 스크립트 8개를 찾지 못함: ' + keepJs.join(', '));
const tail = `
<script>
  /* 발표 페이지 전용: JS가 만드는 문구 속 원본 번호를 발표 번호로 바꾼다 */
  (function () {
    var SEC = ${JSON.stringify(SEC)}, LAB = ${JSON.stringify(LAB)};
    function fix(root) {
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
      while ((n = w.nextNode())) {
        if (n.parentNode.closest && n.parentNode.closest('.kind')) continue;
        var t = n.nodeValue
          .replace(/실험 (\\d+-\\d+)/g, function (m, k) { return '실험 ' + (LAB[k] || k); })
          .replace(/§(\\d+)(?![.\\d])/g, function (m, k) { return SEC[k] || ('전체 실습 §' + k); });
        if (t !== n.nodeValue) n.nodeValue = t;
      }
      root.querySelectorAll('a[href^="#s"]').forEach(function (a) {
        var k = a.getAttribute('href').slice(2);
        if (+k >= 7) a.setAttribute('href', 'index.html#s' + k);
      });
    }
    ['s2-note', 's6-detail', 's6-ln-note'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      fix(el);
      var cfg = { childList: true, subtree: true, characterData: true };
      var obs = new MutationObserver(function () { obs.disconnect(); fix(el); obs.observe(el, cfg); });
      obs.observe(el, cfg);
    });
    /* "Part 2 그림에서 보기" 버튼: Figure 1으로 올라가 해당 블록을 펼친다 */
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-fig-open]');
      if (!b) return;
      var g = document.querySelector('#s6-fig [data-k="' + b.dataset.figOpen + '"]');
      if (g) g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      document.getElementById('lab-6-1').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  })();
  Lab.initRefs();
  Lab.initPredicts();
  Lab.initProgress('attention-talk');
</script>`;

const style = `
<style>
  /* 발표 페이지 전용 */
  .part-band { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; margin-top: 56px; padding: 14px 18px; border-radius: 10px; background: var(--accent-soft); color: var(--ink); }
  .part-n { font-family: var(--font-mono); font-size: 12.5px; font-weight: 600; letter-spacing: .08em; color: var(--accent); }
  .part-t { font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; }
  .part-m { font-size: 13px; color: var(--muted); }
  .part-i { flex-basis: 100%; font-size: 13.5px; color: var(--ink-2); }
  .part-band + .sec { border-top: 0; padding-top: 32px; }
  .sec-head { grid-template-columns: 84px minmax(0, 1fr); }
  .sec-num { white-space: nowrap; font-size: 2.4rem; }
  @media (max-width: 1023px) { .sec-head { grid-template-columns: 58px minmax(0, 1fr); } .sec-num { font-size: 1.7rem; } }
  .toc .toc-part { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 6px; padding: 5px 8px 1px; font-size: 13px; color: var(--muted); font-weight: 600; }
  .toc .toc-part .n { font-family: var(--font-mono); font-size: 12px; }
  .toc .toc-sub a { padding-left: 22px; grid-template-columns: 28px minmax(0, 1fr) 14px; }
  @media (max-width: 1023px) { .toc .toc-part { display: none; } .toc .toc-sub a { padding-left: 10px; } }
</style>
`;

const body = [
  top,
  hero,
  band(1, 'Background', '§1·§2', 2, '왜 RNN을 버렸나: 순차 계산과 긴 경로'),
  p1,
  band(2, '인코더·디코더 구조', '§3.1', 1.5, '전체 그림 먼저: 인코더는 읽고, 디코더는 인코더를 참고하며 한 단어씩 만든다'),
  p2,
  band(3, 'Attention', '§3.2', 4, '3.1 Scaled Dot-Product → 3.2 Multi-Head → 3.3 Masking과 attention의 세 가지 쓰임'),
  p31, p32, p33b,
  band(4, 'Position-wise Feed-Forward', '§3.3', 0.5, ''),
  p4,
  band(5, 'Embeddings · Softmax · Positional Encoding', '§3.4·§3.5', 1.5, '5.1 단어 ↔ 벡터 → 5.2 순서 정보 더하기'),
  p51, p52,
  band(6, '정리: 왜 self-attention인가', '§4', 0.5, ''),
  p6,
  '  </main>\n</div>\n',
  keepJs.map(s => `<script src="${s}"></script>`).join('\n'),
  tail,
  '\n</body>\n</html>\n'
].join('\n');

const notice = '<!-- 이 파일은 tools/build-talk.js가 index.html에서 생성합니다. 직접 고치지 말고 생성기를 고친 뒤 다시 실행하세요. -->\n';
fs.writeFileSync(OUT, head.replace('<!doctype html>', '<!doctype html>\n' + notice) + style + '</head>\n' + body);

const ids = [...fs.readFileSync(OUT, 'utf8').matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
must(!dup.length, '중복 id: ' + [...new Set(dup)].join(', '));
console.log('생성:', path.relative(process.cwd(), OUT), '·', Buffer.byteLength(fs.readFileSync(OUT)), 'bytes');
