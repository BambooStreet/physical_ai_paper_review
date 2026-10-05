/* ==========================================================================
   논문 실습 공통 유틸리티 (window.Lab)
   DOM, 난수, 행렬 연산, 히트맵·차트·막대 컴포넌트, 예측 상자, 진행률·목차
   ========================================================================== */
(function () {
  'use strict';
  var Lab = (window.Lab = window.Lab || {});

  /* ---------- DOM ---------- */
  Lab.$ = function (s, r) { return (r || document).querySelector(s); };
  Lab.$$ = function (s, r) { return Array.from((r || document).querySelectorAll(s)); };
  Lab.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  Lab.clamp = function (x, a, b) { return Math.min(b, Math.max(a, x)); };

  /** 섹션 초기화: 한 섹션이 실패해도 다른 섹션은 동작하도록 감싼다.
      스크립트는 </body> 직전에 있으므로 DOM은 이미 준비돼 있다. DOMContentLoaded를 기다리면
      MathJax(CDN, defer)가 늦게 받아질 때 실험 전체가 멈춰 보이므로 바로 실행한다. */
  Lab.section = function (id, fn) {
    try { fn(); } catch (e) {
      console.error('[' + id + ']', e);
      var s = document.getElementById(id);
      if (s) {
        var w = document.createElement('p');
        w.className = 'err';
        w.textContent = '이 섹션의 실습을 불러오지 못했습니다: ' + e.message;
        s.appendChild(w);
      }
    }
  };

  /* ---------- 숫자 표기 ---------- */
  Lab.fmt = function (x, d) {
    if (d === undefined) d = 2;
    if (x === -Infinity) return '−∞';
    if (x === Infinity) return '∞';
    if (x == null || Number.isNaN(x)) return '—';
    var s = Number(x).toFixed(d);
    if (/^-0(\.0+)?$/.test(s)) s = s.slice(1);
    return s.replace('-', '−');
  };
  Lab.int = function (n) { return Math.round(n).toLocaleString('en-US'); };
  Lab.compact = function (n) {
    var a = Math.abs(n);
    if (a >= 1e12) return +(n / 1e12).toPrecision(3) + 'T';
    if (a >= 1e9) return +(n / 1e9).toPrecision(3) + 'B';
    if (a >= 1e6) return +(n / 1e6).toPrecision(3) + 'M';
    if (a >= 1e4) return +(n / 1e3).toPrecision(3) + 'K';
    if (a >= 1 || a === 0) return String(+Number(n).toPrecision(4));
    if (a >= 0.01) return String(+Number(n).toPrecision(2));
    return Number(n).toExponential(1).replace('e-', 'e−');
  };
  /** 한국어 단위(만·억) 표기 */
  Lab.kor = function (n) {
    if (n >= 1e8) return (n / 1e8).toFixed(2).replace(/\.?0+$/, '') + '억';
    if (n >= 1e4) return Math.round(n / 1e4).toLocaleString('en-US') + '만';
    return Lab.int(n);
  };
  Lab.sub = function (s) { return String(s).replace(/_(\w+)/g, '<sub>$1</sub>'); };

  /* ---------- 난수 (재현 가능하도록 시드 고정) ---------- */
  Lab.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  Lab.gauss = function (r) {
    var u = 0;
    while (u === 0) u = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  };
  Lab.randMat = function (n, m, r, s) {
    s = s === undefined ? 1 : s;
    return Array.from({ length: n }, function () {
      return Array.from({ length: m }, function () { return Lab.gauss(r) * s; });
    });
  };
  Lab.hash = function (str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  /* ---------- 행렬 연산 (배열의 배열) ---------- */
  var M = (Lab.M = {});
  M.zeros = function (n, m) { return Array.from({ length: n }, function () { return new Array(m).fill(0); }); };
  M.T = function (A) { return A[0].map(function (_, j) { return A.map(function (r) { return r[j]; }); }); };
  M.mul = function (A, B) {
    var n = A.length, k = B.length, m = B[0].length, C = M.zeros(n, m);
    for (var i = 0; i < n; i++) {
      var Ci = C[i], Ai = A[i];
      for (var p = 0; p < k; p++) {
        var a = Ai[p];
        if (a === 0) continue;
        var Bp = B[p];
        for (var j = 0; j < m; j++) Ci[j] += a * Bp[j];
      }
    }
    return C;
  };
  M.map = function (A, f) { return A.map(function (r, i) { return r.map(function (v, j) { return f(v, i, j); }); }); };
  M.add = function (A, B) { return M.map(A, function (v, i, j) { return v + B[i][j]; }); };
  M.scale = function (A, s) { return M.map(A, function (v) { return v * s; }); };
  M.cols = function (A, a, b) { return A.map(function (r) { return r.slice(a, b); }); };
  M.dot = function (a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  M.norm = function (a) { return Math.sqrt(M.dot(a, a)); };
  M.cos = function (a, b) { var d = M.norm(a) * M.norm(b); return d ? M.dot(a, b) / d : 0; };
  M.softmax = function (row) {
    var mx = -Infinity, i;
    for (i = 0; i < row.length; i++) if (row[i] > mx) mx = row[i];
    if (mx === -Infinity) return row.map(function () { return 0; });
    var e = row.map(function (v) { return v === -Infinity ? 0 : Math.exp(v - mx); });
    var s = 0;
    for (i = 0; i < e.length; i++) s += e[i];
    return e.map(function (v) { return v / s; });
  };
  M.softmaxRows = function (S) { return S.map(M.softmax); };
  /** Scaled dot-product attention: 단계별 중간값을 모두 돌려준다 */
  M.attention = function (Q, K, V, o) {
    o = o || {};
    var dk = Q[0].length;
    var S = M.mul(Q, M.T(K));
    var sc = o.scale === false ? 1 : 1 / Math.sqrt(dk);
    var Ss = M.scale(S, sc);
    var Sm = o.mask ? M.map(Ss, function (v, i, j) { return o.mask(i, j) ? -Infinity : v; }) : Ss;
    var A = M.softmaxRows(Sm);
    var O = M.mul(A, V);
    return { S: S, Ss: Ss, Sm: Sm, A: A, O: O };
  };

  /* ---------- 색 ---------- */
  Lab.heat = function (t) {
    return 'color-mix(in oklab, var(--heat-1) ' + (Lab.clamp(t, 0, 1) * 100).toFixed(1) + '%, var(--heat-0))';
  };
  Lab.divc = function (t) {
    var p = (Lab.clamp(Math.abs(t), 0, 1) * 100).toFixed(1);
    return 'color-mix(in oklab, var(' + (t >= 0 ? '--pos' : '--neg') + ') ' + p + '%, var(--zero))';
  };
  Lab.inkFor = function (t) { return Math.abs(t) > 0.55 ? 'var(--heat-ink-hi)' : 'var(--ink)'; };
  Lab.cssVar = function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); };
  Lab.rgb = function (name) {
    var h = Lab.cssVar(name).replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    if (h.length !== 6) return [128, 128, 128];
    return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); });
  };
  Lab.mixRGB = function (a, b, t) { return a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }); };
  /** 테마가 바뀌면(시스템 설정·토글) 콜백 — 캔버스 다시 그리기용 */
  Lab.onTheme = function (cb) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', cb); else if (mq.addListener) mq.addListener(cb);
    new MutationObserver(cb).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  };
  Lab.headColor = function (i, h) {
    var hue = (222 + i * 360 / Math.max(h, 1)) % 360;
    return 'hsl(' + hue.toFixed(0) + ' 62% 56%)';
  };

  /* ---------- 히트맵 행렬 ----------
     opts: rows, cols(라벨), digits, mode('seq'|'div'|'none'), range:[lo,hi], values(false면 숫자 숨김),
           cls(크기 클래스), mark(i,j,v)→추가 클래스, onHover(i,j)|(null) */
  Lab.matrix = function (el, A, o) {
    o = o || {};
    var n = A.length, m = n ? A[0].length : 0;
    var d = o.digits === undefined ? 2 : o.digits;
    var lo = Infinity, hi = -Infinity;
    A.forEach(function (r) { r.forEach(function (v) { if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }); });
    if (o.range) { lo = o.range[0]; hi = o.range[1]; }
    if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
    var mode = o.mode || 'seq';
    var mabs = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
    var span = hi - lo || 1;
    var rows = o.rows, cols = o.cols;
    var style = 'grid-template-columns:' + (rows ? 'auto ' : '') + 'repeat(' + m + ', var(--cw))';
    if (o.cw) style += ';--cw:' + o.cw;
    if (o.ch) style += ';--ch:' + o.ch;
    var h = ['<div class="mx' + (o.cls ? ' ' + o.cls : '') + '" style="' + style + '"' + (o.label ? ' role="img" aria-label="' + Lab.esc(o.label) + '"' : '') + '>'];
    if (cols) {
      if (rows) h.push('<span class="mx-corner"></span>');
      cols.forEach(function (c) { h.push('<span class="mx-cl" title="' + Lab.esc(c) + '">' + Lab.esc(c) + '</span>'); });
    }
    for (var i = 0; i < n; i++) {
      if (rows) h.push('<span class="mx-rl">' + Lab.esc(rows[i]) + '</span>');
      for (var j = 0; j < m; j++) {
        var v = A[i][j];
        var cls = 'mx-c', st = '', txt = '';
        if (v === -Infinity || (o.masked && o.masked(i, j))) {
          cls += ' masked';
          txt = o.values === false ? '' : '−∞';
        } else {
          if (mode !== 'none') {
            var t = mode === 'div' ? v / mabs : (v - lo) / span;
            st = 'background:' + (mode === 'div' ? Lab.divc(t) : Lab.heat(t)) + ';color:' + Lab.inkFor(t);
          }
          txt = o.values === false ? '' : Lab.fmt(v, d);
        }
        if (o.mark) { var mk = o.mark(i, j, v); if (mk) cls += ' ' + mk; }
        h.push('<span class="' + cls + '" data-i="' + i + '" data-j="' + j + '" style="' + st + '">' + txt + '</span>');
      }
    }
    h.push('</div>');
    el.innerHTML = h.join('');
    el._onHover = o.onHover || null;
    if (!el._hb) {
      el._hb = true;
      var hov = function (e) {
        var c = e.target.closest && e.target.closest('.mx-c');
        if (c && el._onHover) el._onHover(+c.dataset.i, +c.dataset.j);
      };
      el.addEventListener('mouseover', hov);
      el.addEventListener('click', hov);
      el.addEventListener('mouseleave', function () { if (el._onHover) el._onHover(null); });
    }
  };

  /** 편집 가능한 행렬 */
  Lab.matrixInput = function (el, A, o) {
    o = o || {};
    var n = A.length, m = A[0].length;
    var h = ['<div class="mx mx-in" style="grid-template-columns:' + (o.rows ? 'auto ' : '') + 'repeat(' + m + ', var(--cw))">'];
    if (o.cols) {
      if (o.rows) h.push('<span></span>');
      o.cols.forEach(function (c) { h.push('<span class="mx-cl">' + Lab.esc(c) + '</span>'); });
    }
    for (var i = 0; i < n; i++) {
      if (o.rows) h.push('<span class="mx-rl">' + Lab.esc(o.rows[i]) + '</span>');
      for (var j = 0; j < m; j++) {
        h.push('<input class="mx-inp" type="number" step="0.5" inputmode="decimal" value="' + A[i][j] + '" data-i="' + i + '" data-j="' + j + '" aria-label="' + Lab.esc((o.name || '행렬') + ' ' + (i + 1) + '행 ' + (j + 1) + '열') + '">');
      }
    }
    h.push('</div>');
    el.innerHTML = h.join('');
    el.oninput = function (e) {
      var t = e.target;
      if (!t.classList.contains('mx-inp')) return;
      var v = parseFloat(t.value);
      if (Number.isFinite(v)) { A[+t.dataset.i][+t.dataset.j] = v; if (o.onChange) o.onChange(); }
    };
  };

  /* ---------- 막대 그래프 (HTML) ----------
     items: [{label, value, cls, color}] */
  Lab.bars = function (el, items, o) {
    o = o || {};
    var max = o.max != null ? o.max : Math.max.apply(null, items.map(function (d) { return d.value; }).concat([1e-12]));
    el.classList.add('bars');
    if (o.height) el.style.height = o.height + 'px';
    var dg = o.digits === undefined ? 2 : o.digits;
    el.innerHTML = items.map(function (d) {
      var p = (Lab.clamp(d.value / max, 0, 1) * 100).toFixed(2);
      var val = o.values === false ? '' : (o.fmt ? o.fmt(d.value) : Lab.fmt(d.value, dg));
      return '<div class="bar' + (d.cls ? ' ' + d.cls : '') + '" title="' + Lab.esc(d.label + ': ' + (o.fmt ? o.fmt(d.value) : Lab.fmt(d.value, 4))) + '">' +
        '<span class="bar-track"><span class="bar-fill" style="height:' + p + '%;' + (d.color ? 'background:' + d.color : '') + '"></span>' +
        '<span class="bar-val" style="bottom:' + p + '%">' + val + '</span></span>' +
        '<span class="bar-lab">' + Lab.esc(d.label) + '</span></div>';
    }).join('');
  };

  /* ---------- 선 그래프 (SVG) ---------- */
  Lab.ticks = function (lo, hi, count, type) {
    var t = [], k;
    if (type === 'log2') {
      for (k = Math.ceil(Math.log2(lo) - 1e-9); k <= Math.floor(Math.log2(hi) + 1e-9); k++) t.push(Math.pow(2, k));
      if (t.length > 8) { var st = Math.ceil(t.length / 6); t = t.filter(function (_, i) { return i % st === 0; }); }
      return t;
    }
    if (type === 'log') {
      var a = Math.floor(Math.log10(lo) + 1e-9), b = Math.ceil(Math.log10(hi) - 1e-9);
      for (k = a; k <= b; k++) t.push(Math.pow(10, k));
      if (t.filter(function (v) { return v >= lo * 0.999 && v <= hi * 1.001; }).length < 3) {
        t = [];
        for (k = a; k <= b; k++) [1, 2, 5].forEach(function (f) { t.push(f * Math.pow(10, k)); });
      }
      t = t.filter(function (v) { return v >= lo * 0.999 && v <= hi * 1.001; });
      if (t.length > 8) { var s2 = Math.ceil(t.length / 6); t = t.filter(function (_, i) { return i % s2 === 0; }); }
      return t;
    }
    var span = hi - lo;
    if (!(span > 0)) return [lo];
    var raw = span / (count || 5);
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var r = raw / mag;
    var step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
    for (var v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) t.push(+v.toPrecision(12));
    return t;
  };

  function mkScale(dom, rng, type) {
    if (type === 'log' || type === 'log2') {
      var a = Math.log(dom[0]), b = Math.log(dom[1]);
      var f = function (v) { return rng[0] + (Math.log(Math.max(v, 1e-300)) - a) / (b - a) * (rng[1] - rng[0]); };
      f.inv = function (px) { return Math.exp(a + (px - rng[0]) / (rng[1] - rng[0]) * (b - a)); };
      return f;
    }
    var g = function (v) { return rng[0] + (v - dom[0]) / (dom[1] - dom[0]) * (rng[1] - rng[0]); };
    g.inv = function (px) { return dom[0] + (px - rng[0]) / (rng[1] - rng[0]) * (dom[1] - dom[0]); };
    return g;
  }

  var chartId = 0;
  /**
   * cfg: { height, title, x:{type,domain,label,fmt,ticks}, y:{...},
   *        series:[{name,color,data:[[x,y]],dash,width,area}], vlines:[{x,label,color}],
   *        hlines:[{y,label}], points:[{x,y,label,color}], tip:true|false }
   */
  Lab.Chart = function (el, cfg) {
    this.el = el;
    this.cfg = cfg || {};
    this.id = 'ch' + (++chartId);
    el.classList.add('chart');
    var self = this, w = -1;
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        if (el.clientWidth !== w) { w = el.clientWidth; self.draw(); }
      }).observe(el);
    }
    this.draw();
  };
  Lab.Chart.prototype.set = function (patch) {
    for (var k in patch) this.cfg[k] = patch[k];
    this.draw();
  };
  Lab.Chart.prototype.draw = function () {
    var c = this.cfg, el = this.el;
    if (!el.isConnected) return;
    var W = Math.max(240, el.clientWidth || 560), H = c.height || 230;
    var m = { l: 50, r: 14, t: 12, b: 34 };
    if (c.margin) for (var mk in c.margin) m[mk] = c.margin[mk];
    var xs = c.x || {}, ys = c.y || {};
    var series = (c.series || []).filter(function (s) { return s && s.data && s.data.length; });
    var xd = xs.domain, yd = ys.domain;
    if (!xd || !yd) {
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      series.forEach(function (s) {
        s.data.forEach(function (p) {
          var x = p[0], y = p[1];
          if (!Number.isFinite(x) || !Number.isFinite(y)) return;
          if ((ys.type === 'log') && y <= 0) return;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        });
      });
      if (!xd) xd = Number.isFinite(x0) ? [x0, x1 > x0 ? x1 : x0 + 1] : [0, 1];
      if (!yd) {
        if (!Number.isFinite(y0)) yd = ys.type === 'log' ? [0.1, 1] : [0, 1];
        else if (ys.type === 'log') yd = [y0, y1 > y0 ? y1 : y0 * 10];
        else {
          var lo = ys.zero === false ? y0 : Math.min(0, y0), hi = y1;
          if (hi === lo) hi = lo + 1;
          yd = [lo, hi + (hi - lo) * 0.06];
        }
      }
    }
    var sx = mkScale(xd, [m.l, W - m.r], xs.type), sy = mkScale(yd, [H - m.b, m.t], ys.type);
    var fx = xs.fmt || Lab.compact, fy = ys.fmt || Lab.compact;
    var xt = xs.ticks || Lab.ticks(xd[0], xd[1], Math.max(3, Math.floor((W - m.l - m.r) / 80)), xs.type);
    var yt = ys.ticks || Lab.ticks(yd[0], yd[1], Math.max(3, Math.floor((H - m.t - m.b) / 42)), ys.type);
    var o = [];
    o.push('<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + Lab.esc(c.title || '그래프') + '">');
    o.push('<defs><clipPath id="' + this.id + 'c"><rect x="' + m.l + '" y="' + (m.t - 2) + '" width="' + (W - m.l - m.r) + '" height="' + (H - m.t - m.b + 4) + '"/></clipPath></defs>');
    yt.forEach(function (v) {
      var y = sy(v);
      if (y < m.t - 1 || y > H - m.b + 1) return;
      o.push('<line class="gl" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>');
      o.push('<text x="' + (m.l - 6) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end">' + Lab.esc(fy(v)) + '</text>');
    });
    xt.forEach(function (v) {
      var x = sx(v);
      if (x < m.l - 1 || x > W - m.r + 1) return;
      o.push('<line class="gl" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + m.t + '" y2="' + (H - m.b) + '" style="opacity:.55"/>');
      o.push('<text x="' + x.toFixed(1) + '" y="' + (H - m.b + 15) + '" text-anchor="middle">' + Lab.esc(fx(v)) + '</text>');
    });
    o.push('<line class="axis" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + (H - m.b) + '" y2="' + (H - m.b) + '"/>');
    if (xs.label) o.push('<text class="xlab" x="' + ((m.l + W - m.r) / 2) + '" y="' + (H - 3) + '" text-anchor="middle">' + Lab.esc(xs.label) + '</text>');
    if (ys.label) o.push('<text class="ylab" x="' + m.l + '" y="' + (m.t - 2) + '" text-anchor="start" dy="-2">' + Lab.esc(ys.label) + '</text>');
    var clip = 'clip-path="url(#' + this.id + 'c)"';
    series.forEach(function (s) {
      var pts = s.data.filter(function (p) { return Number.isFinite(p[0]) && Number.isFinite(p[1]) && !(ys.type === 'log' && p[1] <= 0); });
      if (!pts.length) return;
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1); }).join('');
      if (s.area) {
        var base = sy(ys.type === 'log' ? yd[0] : Math.max(yd[0], 0));
        o.push('<path ' + clip + ' d="' + d + 'L' + sx(pts[pts.length - 1][0]).toFixed(1) + ' ' + base.toFixed(1) + 'L' + sx(pts[0][0]).toFixed(1) + ' ' + base.toFixed(1) + 'Z" style="fill:' + s.color + ';opacity:.1;stroke:none"/>');
      }
      o.push('<path ' + clip + ' d="' + d + '" style="fill:none;stroke:' + s.color + ';stroke-width:' + (s.width || 2) + ';stroke-linejoin:round;stroke-linecap:round' + (s.dash ? ';stroke-dasharray:' + s.dash : '') + (s.opacity ? ';opacity:' + s.opacity : '') + '"/>');
    });
    (c.hlines || []).forEach(function (h) {
      var y = sy(h.y);
      if (!(y >= m.t && y <= H - m.b)) return;
      o.push('<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" style="stroke:' + (h.color || 'var(--muted)') + ';stroke-dasharray:4 4;stroke-width:1.2"/>');
      if (h.label) o.push('<text x="' + (W - m.r - 4) + '" y="' + (y - 5).toFixed(1) + '" text-anchor="end" style="fill:' + (h.color || 'var(--muted)') + '">' + Lab.esc(h.label) + '</text>');
    });
    (c.vlines || []).forEach(function (v) {
      var x = sx(v.x);
      if (!(x >= m.l - 0.5 && x <= W - m.r + 0.5)) return;
      o.push('<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + m.t + '" y2="' + (H - m.b) + '" style="stroke:' + (v.color || 'var(--amber)') + ';stroke-width:1.5;stroke-dasharray:' + (v.dash || '5 4') + '"/>');
      if (v.label) {
        var right = x > (m.l + W - m.r) / 2;
        o.push('<text x="' + (x + (right ? -5 : 5)).toFixed(1) + '" y="' + (m.t + 11) + '" text-anchor="' + (right ? 'end' : 'start') + '" style="fill:' + (v.color || 'var(--amber)') + ';font-weight:600">' + Lab.esc(v.label) + '</text>');
      }
    });
    (c.points || []).forEach(function (p) {
      var x = sx(p.x), y = sy(p.y);
      if (!(x >= m.l - 1 && x <= W - m.r + 1 && y >= m.t - 1 && y <= H - m.b + 1)) return;
      o.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (p.r || 4.5) + '" style="fill:' + (p.color || 'var(--amber)') + ';stroke:var(--surface);stroke-width:1.5"/>');
      if (p.label) {
        var rt = x > W - m.r - 120;
        var ly = p.below ? y + 16 : y - 8;
        o.push('<text x="' + (x + (rt ? -7 : 7)).toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + (rt ? 'end' : 'start') + '" style="fill:' + (p.color || 'var(--amber)') + ';font-weight:600">' + Lab.esc(p.label) + '</text>');
      }
    });
    o.push('<line class="guide" x1="0" x2="0" y1="' + m.t + '" y2="' + (H - m.b) + '" style="stroke:var(--ink-2);stroke-width:1;opacity:0"/>');
    o.push('<g class="dots"></g>');
    o.push('</svg>');
    var head = '';
    if (c.title || series.some(function (s) { return s.name; })) {
      head = '<div class="chart-head"><span class="chart-title">' + Lab.esc(c.title || '') + '</span><span class="chart-legend">' +
        series.filter(function (s) { return s.name; }).map(function (s) {
          return '<span><i class="' + (s.dash ? 'dash' : '') + '" style="border-color:' + s.color + '"></i>' + Lab.esc(s.name) + '</span>';
        }).join('') + '</span></div>';
    }
    el.innerHTML = head + '<div class="chart-plot" style="position:relative">' + o.join('') + '<div class="chart-tip" hidden></div></div>';
    if (c.tip === false || !series.length) return;
    var svg = el.querySelector('svg'), tip = el.querySelector('.chart-tip'), guide = svg.querySelector('.guide'), dots = svg.querySelector('.dots');
    var plot = el.querySelector('.chart-plot');
    var hide = function () { tip.hidden = true; guide.style.opacity = 0; dots.innerHTML = ''; };
    svg.addEventListener('mouseleave', hide);
    svg.addEventListener('mousemove', function (e) {
      var rect = svg.getBoundingClientRect();
      var px = (e.clientX - rect.left) * (W / rect.width);
      if (px < m.l || px > W - m.r) { hide(); return; }
      var rows = [], dotHtml = '', gx = null;
      series.forEach(function (s) {
        if (s.noTip) return;
        var best = null, bd = Infinity;
        for (var i = 0; i < s.data.length; i++) {
          var p = s.data[i];
          if (!Number.isFinite(p[1])) continue;
          var dd = Math.abs(sx(p[0]) - px);
          if (dd < bd) { bd = dd; best = p; }
        }
        if (!best || bd > 40) return;
        if (gx === null) gx = best[0];
        var yy = sy(best[1]);
        if (yy >= m.t - 2 && yy <= H - m.b + 2) dotHtml += '<circle cx="' + sx(best[0]).toFixed(1) + '" cy="' + yy.toFixed(1) + '" r="3.5" style="fill:' + s.color + ';stroke:var(--surface);stroke-width:1.5"/>';
        rows.push('<div><i style="background:' + s.color + '"></i>' + Lab.esc(s.name || '') + ' ' + Lab.esc((c.tipFmt || fy)(best[1])) + '</div>');
      });
      if (!rows.length) { hide(); return; }
      dots.innerHTML = dotHtml;
      var gpx = sx(gx);
      guide.setAttribute('x1', gpx); guide.setAttribute('x2', gpx); guide.style.opacity = 0.35;
      tip.innerHTML = '<div style="color:var(--muted)">' + Lab.esc(xs.name || xs.label || 'x') + ' = ' + Lab.esc((xs.tipFmt || fx)(gx)) + '</div>' + rows.join('');
      tip.hidden = false;
      var scale = rect.width / W;
      var left = gpx * scale + 12;
      if (left + tip.offsetWidth > plot.clientWidth) left = gpx * scale - tip.offsetWidth - 12;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = (m.t * scale + 4) + 'px';
    });
  };
  Lab.logspace = function (a, b, n) {
    var la = Math.log(a), lb = Math.log(b), out = [];
    for (var i = 0; i < n; i++) out.push(Math.exp(la + (lb - la) * i / (n - 1)));
    return out;
  };

  /* ---------- 세그먼트 버튼 ---------- */
  Lab.seg = function (el, opts, value, onChange) {
    el.classList.add('seg');
    el.setAttribute('role', 'group');
    el.innerHTML = opts.map(function (o) {
      return '<button type="button" data-v="' + Lab.esc(o.v) + '" aria-pressed="' + (String(o.v) === String(value)) + '">' + o.label + '</button>';
    }).join('');
    el.onclick = function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      Lab.$$('button', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      onChange(b.dataset.v);
    };
    return {
      set: function (v) { Lab.$$('button', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.v === String(v))); }); }
    };
  };

  /** 슬라이더 + <output id="{id}-out"> 묶음 */
  Lab.range = function (id, fmt, cb) {
    var inp = document.getElementById(id), out = document.getElementById(id + '-out');
    function show() { if (out) out.textContent = fmt ? fmt(+inp.value) : inp.value; }
    inp.addEventListener('input', function () { show(); if (cb) cb(+inp.value); });
    show();
    return inp;
  };

  /** MathJax 다시 그리기 (동적으로 넣은 수식) */
  Lab.typeset = function (el) {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise(el ? [el] : undefined).catch(function () {});
    }
  };

  /* ---------- 예측 → 실험 → 확인 ---------- */
  Lab.initPredicts = function () {
    Lab.$$('.predict').forEach(function (box) {
      var opts = Lab.$$('.predict-opt', box);
      var btn = Lab.$('.predict-check', box);
      var reveal = Lab.$('.predict-reveal', box);
      var status = Lab.$('.predict-status', box);
      opts.forEach(function (o, i) {
        var k = document.createElement('span');
        k.className = 'k';
        k.textContent = String.fromCharCode(65 + i);
        o.prepend(k);
        o.type = 'button';
        o.addEventListener('click', function () {
          if (box.dataset.revealed) return;
          opts.forEach(function (x) { x.classList.toggle('chosen', x === o); x.setAttribute('aria-pressed', String(x === o)); });
          btn.disabled = false;
          if (status) status.textContent = '예측을 골랐어요. 아래 실험을 돌려 본 뒤 결과를 확인하세요.';
        });
      });
      btn.addEventListener('click', function () {
        box.dataset.revealed = '1';
        var chosen = opts.find(function (x) { return x.classList.contains('chosen'); });
        opts.forEach(function (o) {
          o.disabled = true;
          if (o.hasAttribute('data-correct')) o.classList.add('correct');
          else if (o === chosen) o.classList.add('wrong');
        });
        var ok = chosen && chosen.hasAttribute('data-correct');
        if (status) status.innerHTML = ok ? '<span class="verdict ok">예측이 맞았습니다.</span>' : '<span class="verdict no">예측과 달랐습니다.</span> 왜 그런지 아래 설명을 보세요.';
        reveal.hidden = false;
        btn.hidden = true;
        Lab.typeset(reveal);
      });
    });
  };

  /* ---------- 원문 대조: 기본은 접어 두고 버튼으로 펼치기 ---------- */
  Lab.initRefs = function () {
    Lab.$$('.paper-ref').forEach(function (ref, idx) {
      if (ref.dataset.ready) return;
      ref.dataset.ready = '1';
      var label = Lab.$('.ref-label', ref);
      var title = '원문 대조';
      if (label && label.firstChild && label.firstChild.nodeType === 3) {
        title = label.firstChild.textContent.trim() || title;
        label.removeChild(label.firstChild);
      }
      var peek = Lab.$$('.ref-sec', ref).map(function (e) { return e.textContent.trim(); }).join(' · ');
      var body = document.createElement('div');
      body.className = 'ref-body';
      body.id = 'ref-body-' + idx;
      while (ref.firstChild) body.appendChild(ref.firstChild);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ref-toggle';
      btn.setAttribute('aria-controls', body.id);
      btn.innerHTML = '<span class="ref-title">' + Lab.esc(title) + '</span>' +
        (peek ? '<span class="ref-peek">' + Lab.esc(peek) + '</span>' : '<span class="ref-peek"></span>') +
        '<span class="ref-act"></span>';
      ref.appendChild(btn);
      ref.appendChild(body);
      var host = ref.closest('.sec-body');
      function set(open) {
        ref.classList.toggle('open', open);
        if (host) host.classList.toggle('ref-closed', !open);
        btn.setAttribute('aria-expanded', String(open));
        btn.querySelector('.ref-act').textContent = open ? '접기' : '펼치기';
      }
      btn.addEventListener('click', function () {
        set(!ref.classList.contains('open'));
        if (ref.classList.contains('open')) Lab.typeset(body);
      });
      set(false);
    });
  };

  /* ---------- 진행률 + 목차 ---------- */
  Lab.initProgress = function (paperId) {
    var done = new Set(window.LabStore ? window.LabStore.getDone(paperId) : []);
    var boxes = Lab.$$('[data-done]');
    function sync() {
      boxes.forEach(function (cb) { cb.checked = done.has(cb.dataset.done); });
      Lab.$$('.toc a[data-sec]').forEach(function (a) { a.classList.toggle('done', done.has(a.dataset.sec)); });
      var c = Lab.$('#toc-count');
      if (c) c.textContent = done.size + ' / ' + boxes.length;
    }
    document.addEventListener('change', function (e) {
      var t = e.target;
      if (!t.matches || !t.matches('[data-done]')) return;
      if (t.checked) done.add(t.dataset.done); else done.delete(t.dataset.done);
      if (window.LabStore) window.LabStore.setDone(paperId, Array.from(done));
      sync();
    });
    sync();

    var links = Lab.$$('.toc a[data-sec]');
    var map = {};
    links.forEach(function (a) { map[a.dataset.sec] = a; });
    if ('IntersectionObserver' in window) {
      var visible = {};
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) { visible[en.target.id] = en.isIntersecting ? en.boundingClientRect.top : undefined; });
        var best = null, bt = Infinity;
        Object.keys(visible).forEach(function (id) {
          var t = visible[id];
          if (t !== undefined && Math.abs(t) < bt) { bt = Math.abs(t); best = id; }
        });
        if (best) {
          links.forEach(function (a) { a.classList.toggle('active', a.dataset.sec === best); });
          var a = map[best];
          if (a && window.innerWidth < 1024) {
            var toc = a.closest('.toc');
            if (toc) toc.scrollTo({ left: a.offsetLeft - 16, behavior: 'smooth' });
          }
        }
      }, { rootMargin: '-20% 0px -60% 0px' });
      Lab.$$('section.sec, header.hero').forEach(function (s) { if (s.id) io.observe(s); });
    }
  };
})();
