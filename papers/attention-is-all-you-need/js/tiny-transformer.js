/* ==========================================================================
   tiny-transformer.js — 브라우저에서 학습하는 아주 작은 Transformer (순수 JS)
   - 외부 라이브러리 없이 Float32Array와 역전파 테이프(tape)로 구현
   - 논문 구조 그대로: 임베딩(×√d, 출력층과 가중치 공유) + 위치 인코딩
     → Post-LN 인코더/디코더 N층 → Linear(공유) → softmax
   - multi-head attention은 reshape/transpose 없이 헤드별 열 구간을 직접 다루는 fused 연산
   - 계산 루프(k*로 시작하는 함수)는 클로저 변수를 쓰지 않도록 분리해 두었다 (V8 최적화)
   ========================================================================== */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.TinyTF = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var F = Float32Array;
  var tape = null; // 역전파를 기록 중이면 배열

  /* ---------- 텐서와 테이프 ---------- */
  function Tensor(data, shape) {
    this.data = data; this.shape = shape;
    this.grad = null; this.needs = false; this.back = null; this.isParam = false;
  }
  function size(shape) { return shape.reduce(function (a, b) { return a * b; }, 1); }
  function param(shape, init) {
    var t = new Tensor(new F(size(shape)), shape);
    if (init) for (var i = 0; i < t.data.length; i++) t.data[i] = init(i);
    t.isParam = true; t.needs = true;
    t.grad = new F(t.data.length); t.m = new F(t.data.length); t.v = new F(t.data.length);
    return t;
  }
  function out(data, shape, parents, back) {
    var t = new Tensor(data, shape);
    if (tape) {
      for (var i = 0; i < parents.length; i++) if (parents[i].needs) { t.needs = true; break; }
      if (t.needs) { t.back = back; tape.push(t); }
    }
    return t;
  }
  function G(t) { if (!t.grad) t.grad = new F(t.data.length); return t.grad; }

  /* ---------- 계산 커널 ----------
     행렬 곱 세 가지 모양을 2행 × 4열 블록으로 계산한다(레지스터 누적, 단순 루프보다 약 4배 빠름).
     모두 C에 더한다(+=). */
  // C[m,n] += A[m,k]·B[k,n]
  function kMM(a, b, C, m, k, n) {
    var i = 0, j, p;
    for (; i + 1 < m; i += 2) {
      var a0 = i * k, a1 = a0 + k, c0 = i * n, c1 = c0 + n;
      for (j = 0; j + 3 < n; j += 4) {
        var s00 = 0, s01 = 0, s02 = 0, s03 = 0, s10 = 0, s11 = 0, s12 = 0, s13 = 0;
        for (p = 0; p < k; p++) {
          var x0 = a[a0 + p], x1 = a[a1 + p], bo = p * n + j;
          var y0 = b[bo], y1 = b[bo + 1], y2 = b[bo + 2], y3 = b[bo + 3];
          s00 += x0 * y0; s01 += x0 * y1; s02 += x0 * y2; s03 += x0 * y3;
          s10 += x1 * y0; s11 += x1 * y1; s12 += x1 * y2; s13 += x1 * y3;
        }
        C[c0 + j] += s00; C[c0 + j + 1] += s01; C[c0 + j + 2] += s02; C[c0 + j + 3] += s03;
        C[c1 + j] += s10; C[c1 + j + 1] += s11; C[c1 + j + 2] += s12; C[c1 + j + 3] += s13;
      }
      for (; j < n; j++) {
        var t0 = 0, t1 = 0;
        for (p = 0; p < k; p++) { var y = b[p * n + j]; t0 += a[a0 + p] * y; t1 += a[a1 + p] * y; }
        C[c0 + j] += t0; C[c1 + j] += t1;
      }
    }
    for (; i < m; i++) {
      var ar = i * k, cr = i * n;
      for (j = 0; j < n; j++) { var u = 0; for (p = 0; p < k; p++) u += a[ar + p] * b[p * n + j]; C[cr + j] += u; }
    }
  }
  // C[m,n] += A[m,k]·B[n,k]ᵀ
  function kMMT(a, b, C, m, k, n) {
    var i = 0, j, p;
    for (; i + 1 < m; i += 2) {
      var a0 = i * k, a1 = a0 + k, c0 = i * n, c1 = c0 + n;
      for (j = 0; j + 3 < n; j += 4) {
        var b0 = j * k, b1 = b0 + k, b2 = b1 + k, b3 = b2 + k;
        var s00 = 0, s01 = 0, s02 = 0, s03 = 0, s10 = 0, s11 = 0, s12 = 0, s13 = 0;
        for (p = 0; p < k; p++) {
          var x0 = a[a0 + p], x1 = a[a1 + p], y0 = b[b0 + p], y1 = b[b1 + p], y2 = b[b2 + p], y3 = b[b3 + p];
          s00 += x0 * y0; s01 += x0 * y1; s02 += x0 * y2; s03 += x0 * y3;
          s10 += x1 * y0; s11 += x1 * y1; s12 += x1 * y2; s13 += x1 * y3;
        }
        C[c0 + j] += s00; C[c0 + j + 1] += s01; C[c0 + j + 2] += s02; C[c0 + j + 3] += s03;
        C[c1 + j] += s10; C[c1 + j + 1] += s11; C[c1 + j + 2] += s12; C[c1 + j + 3] += s13;
      }
      for (; j < n; j++) {
        var bo = j * k, t0 = 0, t1 = 0;
        for (p = 0; p < k; p++) { var y = b[bo + p]; t0 += a[a0 + p] * y; t1 += a[a1 + p] * y; }
        C[c0 + j] += t0; C[c1 + j] += t1;
      }
    }
    for (; i < m; i++) {
      var ar = i * k, cr = i * n;
      for (j = 0; j < n; j++) { var br = j * k, u = 0; for (p = 0; p < k; p++) u += a[ar + p] * b[br + p]; C[cr + j] += u; }
    }
  }
  // C[k,n] += A[m,k]ᵀ·B[m,n]
  function kTMM(a, b, C, m, k, n) {
    var p = 0, j, i;
    for (; p + 1 < k; p += 2) {
      var c0 = p * n, c1 = c0 + n;
      for (j = 0; j + 3 < n; j += 4) {
        var s00 = 0, s01 = 0, s02 = 0, s03 = 0, s10 = 0, s11 = 0, s12 = 0, s13 = 0;
        for (i = 0; i < m; i++) {
          var ao = i * k + p, x0 = a[ao], x1 = a[ao + 1], bo = i * n + j;
          var y0 = b[bo], y1 = b[bo + 1], y2 = b[bo + 2], y3 = b[bo + 3];
          s00 += x0 * y0; s01 += x0 * y1; s02 += x0 * y2; s03 += x0 * y3;
          s10 += x1 * y0; s11 += x1 * y1; s12 += x1 * y2; s13 += x1 * y3;
        }
        C[c0 + j] += s00; C[c0 + j + 1] += s01; C[c0 + j + 2] += s02; C[c0 + j + 3] += s03;
        C[c1 + j] += s10; C[c1 + j + 1] += s11; C[c1 + j + 2] += s12; C[c1 + j + 3] += s13;
      }
      for (; j < n; j++) {
        var t0 = 0, t1 = 0;
        for (i = 0; i < m; i++) { var y = b[i * n + j], ap = i * k + p; t0 += a[ap] * y; t1 += a[ap + 1] * y; }
        C[c0 + j] += t0; C[c1 + j] += t1;
      }
    }
    for (; p < k; p++) {
      var cr = p * n;
      for (j = 0; j < n; j++) { var u = 0; for (i = 0; i < m; i++) u += a[i * k + p] * b[i * n + j]; C[cr + j] += u; }
    }
  }
  function kLN(x, g, be, Y, xh, rs, m, n) {
    for (var i = 0; i < m; i++) {
      var o = i * n, mu = 0, va = 0, j;
      for (j = 0; j < n; j++) mu += x[o + j];
      mu /= n;
      for (j = 0; j < n; j++) { var t = x[o + j] - mu; va += t * t; }
      va /= n;
      var r = 1 / Math.sqrt(va + 1e-5);
      rs[i] = r;
      for (j = 0; j < n; j++) { var h = (x[o + j] - mu) * r; xh[o + j] = h; Y[o + j] = h * g[j] + be[j]; }
    }
  }
  function kLN_back(dY, g, xh, rs, dX, dg, db, m, n) {
    for (var i = 0; i < m; i++) {
      var o = i * n, s1 = 0, s2 = 0, j;
      for (j = 0; j < n; j++) {
        var dy = dY[o + j];
        if (dg !== null) dg[j] += dy * xh[o + j];
        if (db !== null) db[j] += dy;
        var dxh = dy * g[j];
        s1 += dxh; s2 += dxh * xh[o + j];
      }
      if (dX !== null) {
        s1 /= n; s2 /= n;
        var r = rs[i];
        for (j = 0; j < n; j++) dX[o + j] += r * (dY[o + j] * g[j] - s1 - xh[o + j] * s2);
      }
    }
  }
  function kAttn(q, k, v, P, O, row, B, Tq, Tk, h, d, sc, causal) {
    var dk = d / h;
    for (var b = 0; b < B; b++) for (var hd = 0; hd < h; hd++) {
      var co = hd * dk;
      for (var i = 0; i < Tq; i++) {
        var qo = (b * Tq + i) * d + co, jmax = causal ? Math.min(i + 1, Tk) : Tk, mx = -Infinity, j, c;
        for (j = 0; j < jmax; j++) {
          var ko = (b * Tk + j) * d + co, s = 0;
          for (c = 0; c < dk; c++) s += q[qo + c] * k[ko + c];
          s *= sc; row[j] = s;
          if (s > mx) mx = s;
        }
        var sum = 0;
        for (j = 0; j < jmax; j++) { row[j] = Math.exp(row[j] - mx); sum += row[j]; }
        var po = ((b * h + hd) * Tq + i) * Tk;
        for (j = 0; j < jmax; j++) {
          var pj = row[j] / sum;
          P[po + j] = pj;
          var vo = (b * Tk + j) * d + co;
          for (c = 0; c < dk; c++) O[qo + c] += pj * v[vo + c];
        }
      }
    }
  }
  function kAttn_back(dO, q, k, v, P, dQ, dK, dV, dP, B, Tq, Tk, h, d, sc, causal) {
    var dk = d / h;
    for (var b = 0; b < B; b++) for (var hd = 0; hd < h; hd++) {
      var co = hd * dk;
      for (var i = 0; i < Tq; i++) {
        var qo = (b * Tq + i) * d + co, po = ((b * h + hd) * Tq + i) * Tk, jmax = causal ? Math.min(i + 1, Tk) : Tk, dot = 0, j, c;
        for (j = 0; j < jmax; j++) {
          var vo = (b * Tk + j) * d + co, s = 0, pj = P[po + j];
          for (c = 0; c < dk; c++) s += dO[qo + c] * v[vo + c];
          dP[j] = s; dot += s * pj;
          if (dV !== null && pj !== 0) for (c = 0; c < dk; c++) dV[vo + c] += pj * dO[qo + c];
        }
        for (j = 0; j < jmax; j++) {
          var ds = P[po + j] * (dP[j] - dot) * sc;
          if (ds === 0) continue;
          var ko = (b * Tk + j) * d + co;
          if (dQ !== null) for (c = 0; c < dk; c++) dQ[qo + c] += ds * k[ko + c];
          if (dK !== null) for (c = 0; c < dk; c++) dK[ko + c] += ds * q[qo + c];
        }
      }
    }
  }
  function kAcc(dst, src) { for (var i = 0; i < src.length; i++) dst[i] += src[i]; }

  /* ---------- 연산 (forward + backward 등록) ---------- */
  function matmul(A, B) {
    var m = A.shape[0], k = A.shape[1], n = B.shape[1], C = new F(m * n);
    kMM(A.data, B.data, C, m, k, n);
    return out(C, [m, n], [A, B], function (dC) {
      if (A.needs) kMMT(dC, B.data, G(A), m, n, k);   // dA[m,k] += dC[m,n]·B[k,n]ᵀ
      if (B.needs) kTMM(A.data, dC, G(B), m, k, n);   // dB[k,n] += A[m,k]ᵀ·dC[m,n]
    });
  }
  // A[m,k]·B[n,k]ᵀ (출력층: 임베딩 행렬을 전치해 재사용)
  function matmulT(A, B) {
    var m = A.shape[0], k = A.shape[1], n = B.shape[0], C = new F(m * n);
    kMMT(A.data, B.data, C, m, k, n);
    return out(C, [m, n], [A, B], function (dC) {
      if (A.needs) kMM(dC, B.data, G(A), m, n, k);    // dA[m,k] += dC[m,n]·B[n,k]
      if (B.needs) kTMM(dC, A.data, G(B), m, n, k);   // dB[n,k] += dC[m,n]ᵀ·A[m,k]
    });
  }
  function add(A, B) {
    var a = A.data, b = B.data, C = new F(a.length);
    for (var i = 0; i < a.length; i++) C[i] = a[i] + b[i];
    return out(C, A.shape, [A, B], function (dC) {
      if (A.needs) kAcc(G(A), dC);
      if (B.needs) kAcc(G(B), dC);
    });
  }
  function addBias(A, bias) {
    var m = A.shape[0], n = A.shape[1], a = A.data, b = bias.data, C = new F(a.length);
    for (var i = 0; i < m; i++) for (var j = 0; j < n; j++) C[i * n + j] = a[i * n + j] + b[j];
    return out(C, A.shape, [A, bias], function (dC) {
      if (A.needs) kAcc(G(A), dC);
      if (bias.needs) { var db = G(bias); for (var i = 0; i < m; i++) for (var j = 0; j < n; j++) db[j] += dC[i * n + j]; }
    });
  }
  function relu(A) {
    var a = A.data, C = new F(a.length);
    for (var i = 0; i < a.length; i++) C[i] = a[i] > 0 ? a[i] : 0;
    return out(C, A.shape, [A], function (dC) {
      var dA = G(A);
      for (var i = 0; i < a.length; i++) if (a[i] > 0) dA[i] += dC[i];
    });
  }
  // 행마다 평균 0·분산 1로 정규화한 뒤 γ, β
  function layernorm(X, gm, bt) {
    var m = X.shape[0], n = X.shape[1], Y = new F(m * n), xh = new F(m * n), rs = new F(m);
    kLN(X.data, gm.data, bt.data, Y, xh, rs, m, n);
    return out(Y, [m, n], [X, gm, bt], function (dY) {
      kLN_back(dY, gm.data, xh, rs, X.needs ? G(X) : null, gm.needs ? G(gm) : null, bt.needs ? G(bt) : null, m, n);
    });
  }
  // 토큰 ID → 임베딩 행 × s
  function embed(ids, E, s) {
    var M = ids.length, d = E.shape[1], e = E.data, Y = new F(M * d);
    for (var i = 0; i < M; i++) { var r = ids[i] * d, o = i * d; for (var j = 0; j < d; j++) Y[o + j] = e[r + j] * s; }
    return out(Y, [M, d], [E], function (dY) {
      var dE = G(E);
      for (var i = 0; i < M; i++) { var r = ids[i] * d, o = i * d; for (var j = 0; j < d; j++) dE[r + j] += dY[o + j] * s; }
    });
  }
  // X[B·T, d]의 각 행에 위치 벡터 P[t]를 더함
  function addPos(X, P, B, T) {
    var d = X.shape[1], x = X.data, p = P.data, Y = new F(x.length);
    for (var b = 0; b < B; b++) for (var t = 0; t < T; t++) {
      var o = (b * T + t) * d, po = t * d;
      for (var j = 0; j < d; j++) Y[o + j] = x[o + j] + p[po + j];
    }
    return out(Y, X.shape, [X, P], function (dY) {
      if (X.needs) kAcc(G(X), dY);
      if (P.needs) {
        var dP = G(P);
        for (var b = 0; b < B; b++) for (var t = 0; t < T; t++) for (var j = 0; j < d; j++) dP[t * d + j] += dY[(b * T + t) * d + j];
      }
    });
  }
  /* Multi-head scaled dot-product attention (fused)
     Q[B·Tq, d], K·V[B·Tk, d] → O[B·Tq, d]. 헤드 hd는 열 구간 [hd·dk, (hd+1)·dk)를 쓴다.
     결과 텐서의 .P에 attention 가중치 (B, h, Tq, Tk)를 남겨 시각화에 쓴다. */
  function attention(Q, K, Vt, B, Tq, Tk, h, useScale, causal) {
    var d = Q.shape[1], sc = useScale ? 1 / Math.sqrt(d / h) : 1;
    var P = new F(B * h * Tq * Tk), O = new F(B * Tq * d);
    kAttn(Q.data, K.data, Vt.data, P, O, new Float64Array(Tk), B, Tq, Tk, h, d, sc, causal);
    var res = out(O, [B * Tq, d], [Q, K, Vt], function (dO) {
      kAttn_back(dO, Q.data, K.data, Vt.data, P, Q.needs ? G(Q) : null, K.needs ? G(K) : null, Vt.needs ? G(Vt) : null, new Float64Array(Tk), B, Tq, Tk, h, d, sc, causal);
    });
    res.P = P; res.dims = [B, h, Tq, Tk];
    return res;
  }
  // 로짓[M,V]와 정답 → label smoothing cross-entropy (스칼라)
  function softmaxCE(Lg, tgt, ls) {
    var M = Lg.shape[0], V = Lg.shape[1], l = Lg.data, Pm = new F(M * V), loss = 0;
    for (var i = 0; i < M; i++) {
      var o = i * V, mx = -Infinity, sum = 0, k;
      for (k = 0; k < V; k++) if (l[o + k] > mx) mx = l[o + k];
      for (k = 0; k < V; k++) { var e = Math.exp(l[o + k] - mx); Pm[o + k] = e; sum += e; }
      var lse = Math.log(sum) + mx;
      for (k = 0; k < V; k++) {
        Pm[o + k] /= sum;
        var qk = (k === tgt[i] ? 1 - ls : 0) + ls / V;
        if (qk) loss -= qk * (l[o + k] - lse);
      }
    }
    loss /= M;
    var res = out(new F([loss]), [1], [Lg], function (dL) {
      var dl = G(Lg), s = dL[0] / M;
      for (var i = 0; i < M; i++) for (var k = 0; k < V; k++) {
        var qk = (k === tgt[i] ? 1 - ls : 0) + ls / V;
        dl[i * V + k] += s * (Pm[i * V + k] - qk);
      }
    });
    res.probs = Pm;
    return res;
  }
  function backward(loss) {
    loss.grad = new F([1]);
    for (var i = tape.length - 1; i >= 0; i--) { var t = tape[i]; if (t.grad && t.back) t.back(t.grad); }
  }

  /* ---------- 난수 ---------- */
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { var u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }

  /* ---------- 모델 ----------
     cfg: { V, d, h, N, dff, maxLen, pe:'sin'|'learned'|'none', scale, ls, lr, warmup, seed } */
  function Model(cfg) {
    this.cfg = cfg;
    var d = cfg.d, dff = cfg.dff || 4 * d, rng = mulberry(cfg.seed * 1000 + 1), params = (this.params = []);
    function P(shape, std) { var t = param(shape, std ? function () { return gauss(rng) * std; } : null); params.push(t); return t; }
    function glorot(a, b) { return P([a, b], Math.sqrt(2 / (a + b))); }
    function ones(n) { var t = P([n]); t.data.fill(1); return t; }
    function attn() { return { q: glorot(d, d), k: glorot(d, d), v: glorot(d, d), o: glorot(d, d) }; }
    function ffn() { return { w1: glorot(d, dff), b1: P([dff]), w2: glorot(dff, d), b2: P([d]) }; }
    function ln() { return { g: ones(d), b: P([d]) }; }
    this.E = P([cfg.V, d], 1 / Math.sqrt(d));
    this.outB = P([cfg.V]);
    this.enc = []; this.dec = [];
    for (var i = 0; i < cfg.N; i++) this.enc.push({ att: attn(), ln1: ln(), ff: ffn(), ln2: ln() });
    for (i = 0; i < cfg.N; i++) this.dec.push({ self: attn(), ln1: ln(), cross: attn(), ln2: ln(), ff: ffn(), ln3: ln() });
    if (cfg.pe === 'learned') this.pos = P([cfg.maxLen, d], 0.5);
    else {
      var tab = new F(cfg.maxLen * d);
      if (cfg.pe === 'sin') for (var p = 0; p < cfg.maxLen; p++) for (var j = 0; j < d; j++) {
        var w = 1 / Math.pow(10000, 2 * Math.floor(j / 2) / d);
        tab[p * d + j] = j % 2 ? Math.cos(p * w) : Math.sin(p * w);
      }
      this.pos = new Tensor(tab, [cfg.maxLen, d]);
    }
    this.nParams = params.reduce(function (s, t) { return s + t.data.length; }, 0);
    this.step = 0;
    this.dataRng = mulberry(cfg.seed * 7919 + 17);
  }
  Model.prototype.ffn = function (x, f) { return addBias(matmul(relu(addBias(matmul(x, f.w1), f.b1)), f.w2), f.b2); };
  Model.prototype.mha = function (xq, xkv, W, B, Tq, Tk, causal, col) {
    var c = this.cfg;
    var a = attention(matmul(xq, W.q), matmul(xkv, W.k), matmul(xkv, W.v), B, Tq, Tk, c.h, c.scale, causal);
    if (col) col.push(a);
    return matmul(a, W.o);
  };
  Model.prototype.embedPos = function (ids, B, T) {
    var x = embed(ids, this.E, Math.sqrt(this.cfg.d));
    return this.cfg.pe === 'none' ? x : addPos(x, this.pos, B, T);
  };
  Model.prototype.encode = function (src, B, L, col) {
    var self = this, x = this.embedPos(src, B, L);
    this.enc.forEach(function (Ly) {
      x = layernorm(add(x, self.mha(x, x, Ly.att, B, L, L, false, col && col.enc)), Ly.ln1.g, Ly.ln1.b);
      x = layernorm(add(x, self.ffn(x, Ly.ff)), Ly.ln2.g, Ly.ln2.b);
    });
    return x;
  };
  Model.prototype.decode = function (tin, mem, B, T, L, col) {
    var self = this, y = this.embedPos(tin, B, T);
    this.dec.forEach(function (Ly) {
      y = layernorm(add(y, self.mha(y, y, Ly.self, B, T, T, true, col && col.dec)), Ly.ln1.g, Ly.ln1.b);
      y = layernorm(add(y, self.mha(y, mem, Ly.cross, B, T, L, false, col && col.cross)), Ly.ln2.g, Ly.ln2.b);
      y = layernorm(add(y, self.ffn(y, Ly.ff)), Ly.ln3.g, Ly.ln3.b);
    });
    return addBias(matmulT(y, this.E), this.outB);
  };
  Model.prototype.lrAt = function (s) { var c = this.cfg; return c.lr * Math.min(s / c.warmup, Math.sqrt(c.warmup / s)); };
  /** 배치 하나로 1 step 학습. batch: {src, tin, tout (Int32Array), B, L} → loss */
  Model.prototype.trainStep = function (batch) {
    var c = this.cfg, B = batch.B, L = batch.L, T = L + 1;
    this.params.forEach(function (p) { p.grad.fill(0); });
    tape = [];
    var loss;
    try {
      var logits = this.decode(batch.tin, this.encode(batch.src, B, L), B, T, L);
      loss = softmaxCE(logits, batch.tout, c.ls);
      backward(loss);
    } finally { tape = null; }
    // Adam (β1 0.9, β2 0.98, ε 1e-9 — 논문 설정)
    this.step++;
    adam(this.params, this.lrAt(this.step), 1 - Math.pow(0.9, this.step), 1 - Math.pow(0.98, this.step));
    return loss.data[0];
  };
  function adam(params, lr, c1, c2) {
    for (var pi = 0; pi < params.length; pi++) kAdam(params[pi].data, params[pi].grad, params[pi].m, params[pi].v, lr, c1, c2);
  }
  function kAdam(w, g, m, v, lr, c1, c2) {
    for (var i = 0; i < w.length; i++) {
      var gi = g[i];
      m[i] = 0.9 * m[i] + 0.1 * gi;
      v[i] = 0.98 * v[i] + 0.02 * gi * gi;
      w[i] -= lr * (m[i] / c1) / (Math.sqrt(v[i] / c2) + 1e-9);
    }
  }
  /** 배치 greedy 디코딩: src(B×L) → 출력 토큰 (B × (L+1)) */
  Model.prototype.greedy = function (src, B, L, BOS) {
    var mem = this.encode(src, B, L), V = this.cfg.V, outT = new Int32Array(B * (L + 1)), ys = [], b;
    for (b = 0; b < B; b++) ys.push([BOS]);
    for (var t = 0; t < L + 1; t++) {
      var T = t + 1, tin = new Int32Array(B * T);
      for (b = 0; b < B; b++) for (var u = 0; u < T; u++) tin[b * T + u] = ys[b][u];
      var lg = this.decode(tin, mem, B, T, L).data;
      for (b = 0; b < B; b++) {
        var o = (b * T + t) * V, best = 0;
        for (var k = 1; k < V; k++) if (lg[o + k] > lg[o + best]) best = k;
        ys[b].push(best);
        outT[b * (L + 1) + t] = best;
      }
    }
    return outT;
  };
  /** teacher forcing 토큰 정확도 + greedy 문장 정확도 */
  Model.prototype.evaluate = function (data, BOS) {
    var B = data.B, L = data.L, T = L + 1, V = this.cfg.V;
    var lg = this.decode(data.tin, this.encode(data.src, B, L), B, T, L).data, ok = 0, i, k;
    for (i = 0; i < B * T; i++) {
      var best = 0;
      for (k = 1; k < V; k++) if (lg[i * V + k] > lg[i * V + best]) best = k;
      if (best === data.tout[i]) ok++;
    }
    var pred = this.greedy(data.src, B, L, BOS), seqOk = 0;
    for (var b = 0; b < B; b++) {
      var all = true;
      for (var t = 0; t < T; t++) if (pred[b * T + t] !== data.tout[b * T + t]) { all = false; break; }
      if (all) seqOk++;
    }
    return { tok: ok / (B * T), seq: seqOk / B };
  };
  /** 입력 하나(x)와 디코더 입력(tin)에 대한 attention 행렬들: [층][헤드][행][열] */
  Model.prototype.attnMaps = function (x, tin) {
    var L = x.length, T = tin.length, col = { enc: [], dec: [], cross: [] };
    this.decode(Int32Array.from(tin), this.encode(Int32Array.from(x), 1, L, col), 1, T, L, col);
    function unpack(a) {
      var h = a.dims[1], Tq = a.dims[2], Tk = a.dims[3], P = a.P, heads = [];
      for (var hd = 0; hd < h; hd++) {
        var m = [];
        for (var i = 0; i < Tq; i++) { var r = []; for (var j = 0; j < Tk; j++) r.push(P[(hd * Tq + i) * Tk + j]); m.push(r); }
        heads.push(m);
      }
      return heads;
    }
    return { enc: col.enc.map(unpack), dec: col.dec.map(unpack), cross: col.cross.map(unpack) };
  };

  return {
    Model: Model, Tensor: Tensor, param: param, mulberry: mulberry, gauss: gauss,
    ops: { matmul: matmul, matmulT: matmulT, add: add, addBias: addBias, relu: relu, layernorm: layernorm, embed: embed, addPos: addPos, attention: attention, softmaxCE: softmaxCE },
    _setArray: function (A) { F = A; },
    _withTape: function (fn) { tape = []; try { var l = fn(); backward(l); return l; } finally { tape = null; } }
  };
});
