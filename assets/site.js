/* 논문 실습실 — 공통 스크립트: 테마 전환, 진행률 저장소 */
(function () {
  'use strict';
  var root = document.documentElement;
  var KEY = 'lab:theme';
  var ORDER = ['system', 'light', 'dark'];
  var LABEL = { system: '시스템', light: '라이트', dark: '다크' };

  function read() {
    try { return localStorage.getItem(KEY) || 'system'; } catch (e) { return 'system'; }
  }
  function apply(mode) {
    if (mode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      var s = b.querySelector('span');
      if (s) s.textContent = LABEL[mode];
      b.setAttribute('aria-label', '화면 테마: ' + LABEL[mode] + ' (눌러서 바꾸기)');
    });
  }
  var mode = read();
  if (ORDER.indexOf(mode) < 0) mode = 'system';
  document.addEventListener('DOMContentLoaded', function () { apply(mode); });
  apply(mode);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-theme-toggle]');
    if (!b) return;
    mode = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    try { localStorage.setItem(KEY, mode); } catch (err) { /* 저장 불가 환경 */ }
    apply(mode);
  });

  /* 진행률: 논문별로 완료한 섹션 id 목록을 저장 */
  window.LabStore = {
    getDone: function (paperId) {
      try { return JSON.parse(localStorage.getItem('lab:progress:' + paperId) || '[]'); } catch (e) { return []; }
    },
    setDone: function (paperId, ids) {
      try { localStorage.setItem('lab:progress:' + paperId, JSON.stringify(ids)); } catch (e) { /* 무시 */ }
    }
  };
})();
