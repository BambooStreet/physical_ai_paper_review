/* 실습 목록 — 새 논문을 추가하려면 이 배열에 항목을 하나 더 넣으세요.
   status: 'ready'(실습 가능) | 'planned'(준비 중)
   sections: 진행률 계산에 쓰는 섹션 수 (해당 페이지의 data-done 체크박스 개수와 맞추기) */
window.PAPERS = [
  {
    id: 'attention',
    href: 'papers/attention-is-all-you-need/index.html',
    title: 'Attention Is All You Need',
    year: 2017,
    venue: 'NeurIPS 2017',
    arxiv: '1706.03762',
    authors: 'Vaswani, Shazeer, Parmar, Uszkoreit, Jones, Gomez, Kaiser, Polosukhin',
    summary: 'RNN·CNN 없이 attention만으로 만든 번역 모델 Transformer. Scaled dot-product attention부터 마스킹, multi-head, 위치 인코딩, 학습 레시피까지 직접 계산하고, 마지막엔 브라우저에서 작은 Transformer를 학습시킵니다.',
    tags: ['Transformer', 'Self-Attention', '기계번역', '브라우저 학습 실습'],
    sections: 11,
    status: 'ready'
  },
  {
    id: 'act',
    href: '',
    title: 'Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware',
    year: 2023,
    venue: 'RSS 2023',
    arxiv: '2304.13705',
    authors: 'Zhao, Kumar, Levine, Finn',
    summary: 'ACT(Action Chunking with Transformers). Transformer encoder–decoder가 로봇 행동을 덩어리 단위로 예측합니다. 첫 실습의 encoder–decoder 구조가 그대로 이어집니다.',
    tags: ['Imitation Learning', 'Transformer', 'CVAE', 'ALOHA'],
    sections: 0,
    status: 'planned'
  },
  {
    id: 'diffusion-policy',
    href: '',
    title: 'Diffusion Policy: Visuomotor Policy Learning via Action Diffusion',
    year: 2023,
    venue: 'RSS 2023',
    arxiv: '2303.04137',
    authors: 'Chi, Feng, Du, Xu, Cousineau, Burchfiel, Song',
    summary: '행동 시퀀스를 노이즈에서 점진적으로 복원하는 diffusion 기반 정책. 다봉(multimodal) 행동 분포를 다루는 방식을 실험합니다.',
    tags: ['Diffusion', 'Visuomotor Policy', 'Imitation Learning'],
    sections: 0,
    status: 'planned'
  }
];
