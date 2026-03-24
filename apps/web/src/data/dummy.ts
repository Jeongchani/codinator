// 공통으로 사용할 더미 데이터
export const DUMMY_RANKINGS = [
  { 
    id: '1', 
    imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800', 
    content: '미니멀한 봄 코디', 
    likeCount: 8400,
    user: { nickname: '패션피플1' },
    outfitItems: [
      { brand: '무신사 스탠다드', itemName: '화이트 옥스포드 셔츠' },
      { brand: '리바이스', itemName: '501 오리지널 진' }
    ]
  },
  { 
    id: '2', 
    imageUrl: 'https://images.unsplash.com/photo-1539109132374-348214a3c33b?w=800', 
    content: '스트릿 패션의 정석', 
    likeCount: 980,
    user: { nickname: '스트릿킹' },
    outfitItems: [
      { brand: '나이키', itemName: '조던 1 로우' },
      { brand: '스투시', itemName: '월드 투어 후드' }
    ]
  },
  { 
    id: '3', 
    imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800', 
    content: '시크한 올블랙 룩', 
    likeCount: 850,
    user: { nickname: '블랙매니아' },
    outfitItems: [
      { brand: '자라', itemName: '오버사이즈 코트' }
    ]
  }
];