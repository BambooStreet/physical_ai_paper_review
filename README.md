# 논문 실습실

논문의 설계 의도를 직접 실험으로 확인하는 인터랙티브 실습 모음입니다. 빌드 과정이 없는 정적 HTML이라 `index.html`을 브라우저로 바로 열면 됩니다.

## 열기

- **간단히**: `index.html`을 더블클릭
- **로컬 서버로** (권장): 이 폴더에서 아래 명령을 실행한 뒤 http://localhost:8765 접속

```bash
python -m http.server 8765
```

수식(MathJax)과 글꼴(Google Fonts)은 인터넷에서 불러옵니다. 오프라인이면 수식이 원문 TeX로 보이고 글꼴이 시스템 글꼴로 바뀌지만, 실험은 모두 동작합니다.

## 구조

```
index.html                 메인: 실습 목록 (assets/papers.js에서 생성)
assets/
  site.css, site.js        공통 색·글꼴 토큰, 테마 전환, 진행률 저장
  lab.css, lab-core.js     실습 페이지 공통: 레이아웃, 예측 상자, 히트맵·차트 컴포넌트 (window.Lab)
  papers.js                실습 목록 데이터
papers/
  attention-is-all-you-need/
    index.html             섹션 1~11 본문
    js/s1~s11-*.js         섹션별 실험 코드
    js/tiny-transformer.js 브라우저 학습용 순수 JS Transformer (자동미분 포함)
  _template/               새 논문 실습을 시작할 때 복사할 틀
```

## 새 논문 추가

1. `papers/_template/`을 `papers/논문-이름/`으로 복사
2. `assets/papers.js`에 항목 추가 (`id`, `href`, `status: 'ready'`, `sections` 수)
3. 페이지의 `PAPER_ID`를 `papers.js`의 `id`와 맞추기 (진행률 저장 키)

진행률과 테마 설정은 브라우저 localStorage에 저장됩니다.
