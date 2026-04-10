import {
  PrismaClient,
  EvaluationStatus,
  GarmentCategory,
  Gender,
  UserRole,
  VoteChoice,
  RankingPeriod,
  RankingStatus,
  BlurMethod,
  AiBlurStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const userSeeds = [
  {
    key: 'admin',
    email: 'admin@codinator.com',
    nickname: '관리자',
    password: '1234',
    gender: Gender.MALE,
    birthDate: new Date('1990-01-01'),
    phoneNumber: '01000000000',
    role: UserRole.SUPER_ADMIN,
  },
  {
    key: 'alice',
    email: 'alice@codinator.com',
    nickname: '앨리스',
    password: '1234',
    gender: Gender.FEMALE,
    birthDate: new Date('2000-01-01'),
    phoneNumber: '01011112222',
  },
  {
    key: 'bob',
    email: 'bob@codinator.com',
    nickname: '밥',
    password: '1234',
    gender: Gender.MALE,
    birthDate: new Date('1999-02-02'),
    phoneNumber: '01022223333',
  },
  {
    key: 'charlie',
    email: 'charlie@codinator.com',
    nickname: '찰리',
    password: '1234',
    gender: Gender.MALE,
    birthDate: new Date('1998-03-03'),
    phoneNumber: '01033334444',
  },
  {
    key: 'diana',
    email: 'diana@codinator.com',
    nickname: '다이애나',
    password: '1234',
    gender: Gender.FEMALE,
    birthDate: new Date('2001-04-04'),
    phoneNumber: '01044445555',
  },
];

const keywordSeeds = [
  { code: 'BOYFRIEND_LOOK', label: '남친룩', sortOrder: 1 },
  { code: 'DAILY_LOOK', label: '데일리룩', sortOrder: 2 },
  { code: 'OFFICE_LOOK', label: '출근룩', sortOrder: 3 },
  { code: 'STREET_LOOK', label: '스트릿룩', sortOrder: 4 },
  { code: 'CAMPUS_LOOK', label: '캠퍼스룩', sortOrder: 5 },
];

const feedbackTagSeeds = [
  {
    code: 'POS_FIT_GOOD',
    label: '핏이 좋아요',
    groupCode: 'FIT',
    voteChoice: VoteChoice.LIKE,
    isActive: true,
    sortOrder: 1,
  },
  {
    code: 'POS_POINT_GOOD',
    label: '포인트가 좋아요',
    groupCode: 'STYLE',
    voteChoice: VoteChoice.LIKE,
    isActive: true,
    sortOrder: 2,
  },
  {
    code: 'NEG_SIZE_BAD',
    label: '핏/사이즈가 아쉬워요',
    groupCode: 'FIT',
    voteChoice: VoteChoice.DISLIKE,
    isActive: true,
    sortOrder: 3,
  },
  {
    code: 'NEG_COLOR_BAD',
    label: '색 조합이 아쉬워요',
    groupCode: 'COLOR',
    voteChoice: VoteChoice.DISLIKE,
    isActive: true,
    sortOrder: 4,
  },
  {
    code: 'NEG_MATCHING_BAD',
    label: '아이템 매치가 어색해요',
    groupCode: 'MATCHING',
    voteChoice: VoteChoice.DISLIKE,
    isActive: true,
    sortOrder: 5,
  },
];

const SEED_IMAGE_BASE_URL = '/uploads/seeds/posts';
const AVAILABLE_OPEN_IMAGE_NAMES = ['open-post-1.jpg', 'open-post-2.jpg'];
const AVAILABLE_RANKED_IMAGE_NAMES = ['ranked-post-1.jpg', 'ranked-post-2.jpg'];

const ALL_USER_KEYS = ['alice', 'bob', 'charlie', 'diana'];

const OPEN_POST_SEEDS = [
  {
    imageName: 'open-post-1.jpg',
    authorKey: 'alice',
    content: '[SEED] 오늘 수업 끝나고 바로 찍은 봄 남친룩인데 전체 밸런스 어떤가요?',
    keywordCodes: ['BOYFRIEND_LOOK', 'DAILY_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '옥스포드 셔츠', brand: 'SPAO' },
      { category: GarmentCategory.BOTTOM, itemName: '라이트 워시 데님', brand: 'MUSINSA STANDARD' },
      { category: GarmentCategory.SHOES, itemName: '캔버스 스니커즈', brand: 'CONVERSE' },
    ],
    openOffsetDays: { start: -1, end: 6 },
  },
  {
    imageName: 'open-post-2.jpg',
    authorKey: 'charlie',
    content: '[SEED] 편하게 입은 캠퍼스룩인데 후드집업 색감이 너무 무거운지 봐주세요.',
    keywordCodes: ['CAMPUS_LOOK', 'DAILY_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '그레이 후드집업', brand: 'MUSINSA STANDARD' },
      { category: GarmentCategory.BOTTOM, itemName: '블랙 와이드 팬츠', brand: '8SECONDS' },
      { category: GarmentCategory.SHOES, itemName: '러닝 스니커즈', brand: 'NIKE' },
    ],
    openOffsetDays: { start: 0, end: 7 },
  },
  {
    imageName: 'open-post-3.jpg',
    authorKey: 'diana',
    content: '[SEED] 셔츠+슬랙스 출근룩인데 너무 딱딱해 보이는지 피드백 부탁드려요.',
    keywordCodes: ['OFFICE_LOOK', 'DAILY_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '스트라이프 셔츠', brand: 'COS' },
      { category: GarmentCategory.BOTTOM, itemName: '세미와이드 슬랙스', brand: 'UNIQLO' },
      { category: GarmentCategory.BAG, itemName: '미니 토트백', brand: 'MATIN KIM' },
    ],
    openOffsetDays: { start: -2, end: 5 },
  },
  {
    imageName: 'open-post-4.jpg',
    authorKey: 'bob',
    content: '[SEED] 레더 자켓 포인트 준 스트릿룩인데 상의 핏이 괜찮은지 궁금합니다.',
    keywordCodes: ['STREET_LOOK', 'DAILY_LOOK'],
    outfitItems: [
      { category: GarmentCategory.OUTER, itemName: '블랙 레더 자켓', brand: 'ZARA' },
      { category: GarmentCategory.TOP, itemName: '프린팅 반팔', brand: 'THISISNEVERTHAT' },
      { category: GarmentCategory.BOTTOM, itemName: '카고 팬츠', brand: 'CARHARTT' },
    ],
    openOffsetDays: { start: -1, end: 8 },
  },
  {
    imageName: 'open-post-5.jpg',
    authorKey: 'alice',
    content: '[SEED] 가디건으로 톤 맞춘 데일리룩인데 신발까지 포함해서 조화가 맞는지 봐주세요.',
    keywordCodes: ['DAILY_LOOK', 'BOYFRIEND_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '베이지 가디건', brand: 'SPAO' },
      { category: GarmentCategory.BOTTOM, itemName: '크림 코튼 팬츠', brand: 'COS' },
      { category: GarmentCategory.SHOES, itemName: '브라운 로퍼', brand: 'HARUTA' },
    ],
    openOffsetDays: { start: 0, end: 6 },
  },
  {
    imageName: 'open-post-6.jpg',
    authorKey: 'charlie',
    content: '[SEED] 맨투맨+조거팬츠로 편하게 입어봤는데 너무 평범한지 의견 주세요.',
    keywordCodes: ['CAMPUS_LOOK', 'DAILY_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '네이비 맨투맨', brand: 'MUSINSA STANDARD' },
      { category: GarmentCategory.BOTTOM, itemName: '그레이 조거 팬츠', brand: 'NIKE' },
      { category: GarmentCategory.SHOES, itemName: '러닝화', brand: 'NEW BALANCE' },
    ],
    openOffsetDays: { start: -1, end: 9 },
  },
  {
    imageName: 'open-post-7.jpg',
    authorKey: 'diana',
    content: '[SEED] 데님 자켓 코디인데 상하의 컬러 밸런스가 애매하지 않은지 봐주세요.',
    keywordCodes: ['STREET_LOOK', 'CAMPUS_LOOK'],
    outfitItems: [
      { category: GarmentCategory.OUTER, itemName: '데님 자켓', brand: 'LEVI’S' },
      { category: GarmentCategory.TOP, itemName: '화이트 무지티', brand: 'UNIQLO' },
      { category: GarmentCategory.BOTTOM, itemName: '차콜 카고 팬츠', brand: 'CARHARTT' },
    ],
    openOffsetDays: { start: -2, end: 7 },
  },
  {
    imageName: 'open-post-8.jpg',
    authorKey: 'bob',
    content: '[SEED] 셔츠랑 테이퍼드 팬츠로 깔끔하게 입었는데 가방 선택이 괜찮은지 궁금합니다.',
    keywordCodes: ['OFFICE_LOOK', 'DAILY_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '화이트 셔츠', brand: 'COS' },
      { category: GarmentCategory.BOTTOM, itemName: '테이퍼드 팬츠', brand: 'UNIQLO' },
      { category: GarmentCategory.BAG, itemName: '블랙 토트백', brand: 'MATIN KIM' },
    ],
    openOffsetDays: { start: 0, end: 10 },
  },
  {
    imageName: 'open-post-9.jpg',
    authorKey: 'alice',
    content: '[SEED] 셔츠+더비슈즈로 살짝 단정하게 입었는데 학생 느낌이 너무 강한가요?',
    keywordCodes: ['BOYFRIEND_LOOK', 'CAMPUS_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '스트라이프 셔츠', brand: 'SPAO' },
      { category: GarmentCategory.BOTTOM, itemName: '세미와이드 슬랙스', brand: '8SECONDS' },
      { category: GarmentCategory.SHOES, itemName: '더비슈즈', brand: 'DR.MARTENS' },
    ],
    openOffsetDays: { start: -1, end: 5 },
  },
  {
    imageName: 'open-post-10.jpg',
    authorKey: 'charlie',
    content: '[SEED] 집업이랑 스웻팬츠 조합인데 너무 운동복처럼 보이는지 피드백 부탁드립니다.',
    keywordCodes: ['DAILY_LOOK', 'STREET_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '후드집업', brand: 'MUSINSA STANDARD' },
      { category: GarmentCategory.BOTTOM, itemName: '와이드 스웻팬츠', brand: 'NIKE' },
      { category: GarmentCategory.SHOES, itemName: '젤 러닝화', brand: 'ASICS' },
    ],
    openOffsetDays: { start: -2, end: 6 },
  },
  {
    imageName: 'open-post-11.jpg',
    authorKey: 'diana',
    content: '[SEED] 니트랑 롱스커트 느낌으로 찍은 코디인데 지금 계절감에 맞는지 궁금해요.',
    keywordCodes: ['DAILY_LOOK', 'OFFICE_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '라운드 니트', brand: '8SECONDS' },
      { category: GarmentCategory.BOTTOM, itemName: '플리츠 스커트', brand: 'ZARA' },
      { category: GarmentCategory.BAG, itemName: '숄더백', brand: 'MATIN KIM' },
    ],
    openOffsetDays: { start: 0, end: 8 },
  },
  {
    imageName: 'open-post-12.jpg',
    authorKey: 'bob',
    content: '[SEED] 셔츠 위에 가볍게 아우터 걸친 남친룩인데 전체 실루엣이 어색한지 봐주세요.',
    keywordCodes: ['BOYFRIEND_LOOK', 'DAILY_LOOK'],
    outfitItems: [
      { category: GarmentCategory.OUTER, itemName: '나일론 블루종', brand: 'ZARA' },
      { category: GarmentCategory.TOP, itemName: '화이트 셔츠', brand: 'UNIQLO' },
      { category: GarmentCategory.BOTTOM, itemName: '치노 팬츠', brand: 'SPAO' },
    ],
    openOffsetDays: { start: -1, end: 7 },
  },
];

const WEEKLY_RANKING_SEEDS = [
  {
    imageName: 'ranked-post-1.jpg',
    authorKey: 'bob',
    content: '[SEED] 이번 주 스트릿 무드 코디입니다. 자켓이 과하지 않은지 봐주세요.',
    keywordCodes: ['STREET_LOOK', 'DAILY_LOOK'],
    outfitItems: [
      { category: GarmentCategory.OUTER, itemName: '블랙 레더 자켓', brand: 'ZARA' },
      { category: GarmentCategory.TOP, itemName: '그래픽 티셔츠', brand: 'THISISNEVERTHAT' },
      { category: GarmentCategory.BOTTOM, itemName: '카고 팬츠', brand: 'CARHARTT' },
    ],
    profile: 'good',
  },
  {
    imageName: 'ranked-post-2.jpg',
    authorKey: 'diana',
    content: '[SEED] 셔츠와 니트 레이어드 출근룩입니다. 깔끔한 쪽으로 의도했어요.',
    keywordCodes: ['OFFICE_LOOK', 'CAMPUS_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '레이어드 니트', brand: '8SECONDS' },
      { category: GarmentCategory.BOTTOM, itemName: '슬랙스', brand: 'UNIQLO' },
      { category: GarmentCategory.BAG, itemName: '크로스백', brand: 'MATIN KIM' },
    ],
    profile: 'weak',
  },
  {
    imageName: 'ranked-post-3.jpg',
    authorKey: 'alice',
    content: '[SEED] 크림톤으로 맞춘 데일리룩입니다. 편안한 분위기가 잘 사는지 궁금합니다.',
    keywordCodes: ['DAILY_LOOK', 'BOYFRIEND_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '브이넥 가디건', brand: 'SPAO' },
      { category: GarmentCategory.BOTTOM, itemName: '아이보리 코튼 팬츠', brand: 'COS' },
      { category: GarmentCategory.SHOES, itemName: '브라운 로퍼', brand: 'HARUTA' },
    ],
    profile: 'perfect',
  },
  {
    imageName: 'ranked-post-4.jpg',
    authorKey: 'charlie',
    content: '[SEED] 후드집업 중심의 캐주얼 코디입니다. 핏이 괜찮게 떨어지는지 봐주세요.',
    keywordCodes: ['CAMPUS_LOOK', 'DAILY_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '그레이 후드집업', brand: 'MUSINSA STANDARD' },
      { category: GarmentCategory.BOTTOM, itemName: '와이드 팬츠', brand: '8SECONDS' },
      { category: GarmentCategory.SHOES, itemName: '러닝 스니커즈', brand: 'NIKE' },
    ],
    profile: 'perfect',
  },
  {
    imageName: 'ranked-post-5.jpg',
    authorKey: 'diana',
    content: '[SEED] 단정한 셔츠 코디인데 출근룩으로 무난한지 체크 부탁드려요.',
    keywordCodes: ['OFFICE_LOOK', 'DAILY_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '화이트 셔츠', brand: 'COS' },
      { category: GarmentCategory.BOTTOM, itemName: '차콜 슬랙스', brand: 'UNIQLO' },
      { category: GarmentCategory.SHOES, itemName: '블랙 로퍼', brand: 'HARUTA' },
    ],
    profile: 'perfect',
  },
  {
    imageName: 'ranked-post-6.jpg',
    authorKey: 'bob',
    content: '[SEED] 블루종이 포인트인 가벼운 스트릿룩입니다. 실루엣 중심으로 봐주세요.',
    keywordCodes: ['STREET_LOOK', 'CAMPUS_LOOK'],
    outfitItems: [
      { category: GarmentCategory.OUTER, itemName: '나일론 블루종', brand: 'ZARA' },
      { category: GarmentCategory.TOP, itemName: '화이트 무지티', brand: 'UNIQLO' },
      { category: GarmentCategory.BOTTOM, itemName: '와이드 카고 팬츠', brand: 'CARHARTT' },
    ],
    profile: 'good',
  },
  {
    imageName: 'ranked-post-7.jpg',
    authorKey: 'alice',
    content: '[SEED] 셔츠와 가디건 조합으로 남친룩 느낌을 냈습니다. 무난한지 봐주세요.',
    keywordCodes: ['BOYFRIEND_LOOK', 'DAILY_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '스트라이프 셔츠', brand: 'SPAO' },
      { category: GarmentCategory.OUTER, itemName: '베이지 가디건', brand: 'SPAO' },
      { category: GarmentCategory.BOTTOM, itemName: '세미와이드 슬랙스', brand: '8SECONDS' },
    ],
    profile: 'perfect',
  },
  {
    imageName: 'ranked-post-8.jpg',
    authorKey: 'charlie',
    content: '[SEED] 와이드 스웻팬츠 조합인데 편한 무드가 잘 사는지 궁금합니다.',
    keywordCodes: ['DAILY_LOOK', 'STREET_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '후드집업', brand: 'MUSINSA STANDARD' },
      { category: GarmentCategory.BOTTOM, itemName: '스웻팬츠', brand: 'NIKE' },
      { category: GarmentCategory.SHOES, itemName: '젤 러닝화', brand: 'ASICS' },
    ],
    profile: 'perfect',
  },
  {
    imageName: 'ranked-post-9.jpg',
    authorKey: 'diana',
    content: '[SEED] 옥스포드 셔츠와 치노 팬츠 코디입니다. 대학생 느낌으로 입어봤어요.',
    keywordCodes: ['CAMPUS_LOOK', 'BOYFRIEND_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '옥스포드 셔츠', brand: 'UNIQLO' },
      { category: GarmentCategory.BOTTOM, itemName: '치노 팬츠', brand: 'SPAO' },
      { category: GarmentCategory.SHOES, itemName: '캔버스 스니커즈', brand: 'CONVERSE' },
    ],
    profile: 'perfect',
  },
  {
    imageName: 'ranked-post-10.jpg',
    authorKey: 'bob',
    content: '[SEED] 터틀넥 기반 모노톤 코디입니다. 차분한 느낌이 살았는지 봐주세요.',
    keywordCodes: ['OFFICE_LOOK', 'STREET_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '블랙 터틀넥', brand: 'COS' },
      { category: GarmentCategory.BOTTOM, itemName: '울 슬랙스', brand: 'MUSINSA STANDARD' },
      { category: GarmentCategory.SHOES, itemName: '첼시부츠', brand: 'ZARA' },
    ],
    profile: 'good',
  },
  {
    imageName: 'ranked-post-11.jpg',
    authorKey: 'alice',
    content: '[SEED] 데님 자켓 활용한 캐주얼 코디입니다. 색조합이 무난한지 궁금합니다.',
    keywordCodes: ['CAMPUS_LOOK', 'DAILY_LOOK'],
    outfitItems: [
      { category: GarmentCategory.OUTER, itemName: '데님 자켓', brand: 'LEVI’S' },
      { category: GarmentCategory.TOP, itemName: '화이트 반팔', brand: 'UNIQLO' },
      { category: GarmentCategory.BOTTOM, itemName: '차콜 팬츠', brand: '8SECONDS' },
    ],
    profile: 'good',
  },
  {
    imageName: 'ranked-post-12.jpg',
    authorKey: 'charlie',
    content: '[SEED] 셔츠와 블루종으로 깔끔하게 정리한 코디입니다. 핏 위주로 봐주세요.',
    keywordCodes: ['BOYFRIEND_LOOK', 'DAILY_LOOK'],
    outfitItems: [
      { category: GarmentCategory.OUTER, itemName: '라이트 블루종', brand: 'ZARA' },
      { category: GarmentCategory.TOP, itemName: '화이트 셔츠', brand: 'UNIQLO' },
      { category: GarmentCategory.BOTTOM, itemName: '베이지 팬츠', brand: 'COS' },
    ],
    profile: 'good',
  },
];

const MONTHLY_RANKING_SEEDS = [
  {
    imageName: 'ranked-post-13.jpg',
    authorKey: 'alice',
    content: '[SEED] 한 달 동안 가장 반응 좋았던 크림톤 데일리룩입니다.',
    keywordCodes: ['DAILY_LOOK', 'BOYFRIEND_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '브이넥 가디건', brand: 'SPAO' },
      { category: GarmentCategory.BOTTOM, itemName: '코튼 팬츠', brand: 'COS' },
      { category: GarmentCategory.SHOES, itemName: '브라운 로퍼', brand: 'HARUTA' },
    ],
    profile: 'perfect',
  },
  {
    imageName: 'ranked-post-14.jpg',
    authorKey: 'bob',
    content: '[SEED] 레더 자켓과 그래픽 티 조합으로 만든 월간 스트릿 코디입니다.',
    keywordCodes: ['STREET_LOOK', 'DAILY_LOOK'],
    outfitItems: [
      { category: GarmentCategory.OUTER, itemName: '레더 자켓', brand: 'ZARA' },
      { category: GarmentCategory.TOP, itemName: '그래픽 티셔츠', brand: 'THISISNEVERTHAT' },
      { category: GarmentCategory.BOTTOM, itemName: '카고 팬츠', brand: 'CARHARTT' },
    ],
    profile: 'perfect',
  },
  {
    imageName: 'ranked-post-15.jpg',
    authorKey: 'diana',
    content: '[SEED] 셔츠와 니트로 정리한 월간 출근룩입니다. 단정함 위주입니다.',
    keywordCodes: ['OFFICE_LOOK', 'CAMPUS_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '라운드 니트', brand: '8SECONDS' },
      { category: GarmentCategory.BOTTOM, itemName: '블랙 슬랙스', brand: 'UNIQLO' },
      { category: GarmentCategory.BAG, itemName: '미니 크로스백', brand: 'MATIN KIM' },
    ],
    profile: 'good',
  },
  {
    imageName: 'ranked-post-16.jpg',
    authorKey: 'charlie',
    content: '[SEED] 맨투맨과 조거 팬츠로 완성한 월간 캠퍼스룩입니다.',
    keywordCodes: ['CAMPUS_LOOK', 'DAILY_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '네이비 맨투맨', brand: 'MUSINSA STANDARD' },
      { category: GarmentCategory.BOTTOM, itemName: '그레이 조거 팬츠', brand: 'NIKE' },
      { category: GarmentCategory.SHOES, itemName: '운동화', brand: 'NEW BALANCE' },
    ],
    profile: 'perfect',
  },
  {
    imageName: 'ranked-post-17.jpg',
    authorKey: 'alice',
    content: '[SEED] 데님 자켓 포인트 준 월간 캐주얼 코디입니다.',
    keywordCodes: ['STREET_LOOK', 'CAMPUS_LOOK'],
    outfitItems: [
      { category: GarmentCategory.OUTER, itemName: '데님 자켓', brand: 'LEVI’S' },
      { category: GarmentCategory.TOP, itemName: '화이트 반팔', brand: 'UNIQLO' },
      { category: GarmentCategory.BOTTOM, itemName: '차콜 카고 팬츠', brand: 'CARHARTT' },
    ],
    profile: 'perfect',
  },
  {
    imageName: 'ranked-post-18.jpg',
    authorKey: 'diana',
    content: '[SEED] 셔츠와 테이퍼드 팬츠 기반의 월간 미니멀 출근룩입니다.',
    keywordCodes: ['OFFICE_LOOK', 'DAILY_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '화이트 셔츠', brand: 'COS' },
      { category: GarmentCategory.BOTTOM, itemName: '테이퍼드 팬츠', brand: 'UNIQLO' },
      { category: GarmentCategory.BAG, itemName: '토트백', brand: 'MATIN KIM' },
    ],
    profile: 'good',
  },
  {
    imageName: 'ranked-post-19.jpg',
    authorKey: 'bob',
    content: '[SEED] 셔츠와 더비슈즈로 정리한 월간 남친룩입니다.',
    keywordCodes: ['BOYFRIEND_LOOK', 'DAILY_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '스트라이프 셔츠', brand: 'SPAO' },
      { category: GarmentCategory.BOTTOM, itemName: '세미와이드 슬랙스', brand: '8SECONDS' },
      { category: GarmentCategory.SHOES, itemName: '더비슈즈', brand: 'DR.MARTENS' },
    ],
    profile: 'perfect',
  },
  {
    imageName: 'ranked-post-20.jpg',
    authorKey: 'charlie',
    content: '[SEED] 후드집업과 스웻팬츠로 만든 월간 편한 코디입니다.',
    keywordCodes: ['DAILY_LOOK', 'STREET_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '후드집업', brand: 'MUSINSA STANDARD' },
      { category: GarmentCategory.BOTTOM, itemName: '와이드 스웻팬츠', brand: 'NIKE' },
      { category: GarmentCategory.SHOES, itemName: '러닝화', brand: 'ASICS' },
    ],
    profile: 'good',
  },
  {
    imageName: 'ranked-post-21.jpg',
    authorKey: 'diana',
    content: '[SEED] 옥스포드 셔츠 위주로 풀어낸 월간 캠퍼스 남친룩입니다.',
    keywordCodes: ['CAMPUS_LOOK', 'BOYFRIEND_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '옥스포드 셔츠', brand: 'UNIQLO' },
      { category: GarmentCategory.BOTTOM, itemName: '치노 팬츠', brand: 'SPAO' },
      { category: GarmentCategory.SHOES, itemName: '캔버스 스니커즈', brand: 'CONVERSE' },
    ],
    profile: 'good',
  },
  {
    imageName: 'ranked-post-22.jpg',
    authorKey: 'bob',
    content: '[SEED] 모노톤 터틀넥 코디로 마무리한 월간 깔끔 스타일입니다.',
    keywordCodes: ['OFFICE_LOOK', 'STREET_LOOK'],
    outfitItems: [
      { category: GarmentCategory.TOP, itemName: '블랙 터틀넥', brand: 'COS' },
      { category: GarmentCategory.BOTTOM, itemName: '울 슬랙스', brand: 'MUSINSA STANDARD' },
      { category: GarmentCategory.SHOES, itemName: '첼시부츠', brand: 'ZARA' },
    ],
    profile: 'weak',
  },
];

const PROFILE_CONFIG = {
  perfect: {
    choices: [VoteChoice.LIKE, VoteChoice.LIKE, VoteChoice.LIKE],
    tagCodes: ['POS_FIT_GOOD', 'POS_POINT_GOOD', 'POS_POINT_GOOD'],
    score: 3,
    likeCount: 3,
    dislikeCount: 0,
    totalCount: 3,
    likeRate: 1.0,
  },
  good: {
    choices: [VoteChoice.LIKE, VoteChoice.LIKE, VoteChoice.DISLIKE],
    tagCodes: ['POS_FIT_GOOD', 'POS_POINT_GOOD', 'NEG_COLOR_BAD'],
    score: 2,
    likeCount: 2,
    dislikeCount: 1,
    totalCount: 3,
    likeRate: 0.6667,
  },
  weak: {
    choices: [VoteChoice.LIKE, VoteChoice.DISLIKE, VoteChoice.DISLIKE],
    tagCodes: ['POS_POINT_GOOD', 'NEG_SIZE_BAD', 'NEG_MATCHING_BAD'],
    score: 1,
    likeCount: 1,
    dislikeCount: 2,
    totalCount: 3,
    likeRate: 0.3333,
  },
};

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay();
  const diff = day === 0 ? 6 : day - 1;
  value.setDate(value.getDate() - diff);
  return value;
}

function endOfWeek(date) {
  const value = startOfWeek(date);
  value.setDate(value.getDate() + 6);
  value.setHours(23, 59, 59, 999);
  return value;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function setTime(date, hour, minute) {
  const value = new Date(date);
  value.setHours(hour, minute, 0, 0);
  return value;
}

function minDate(left, right) {
  return left.getTime() <= right.getTime() ? left : right;
}

function resolveSeedImageName(filename) {
  const openMatch = filename.match(/^open-post-(\d+)\.jpg$/);
  if (openMatch) {
    const index = (Number(openMatch[1]) - 1) % AVAILABLE_OPEN_IMAGE_NAMES.length;
    return AVAILABLE_OPEN_IMAGE_NAMES[index];
  }

  const rankedMatch = filename.match(/^ranked-post-(\d+)\.jpg$/);
  if (rankedMatch) {
    const index = (Number(rankedMatch[1]) - 1) % AVAILABLE_RANKED_IMAGE_NAMES.length;
    return AVAILABLE_RANKED_IMAGE_NAMES[index];
  }

  return filename;
}

function buildImageCreate(filename) {
  const resolvedFilename = resolveSeedImageName(filename);
  const url = `${SEED_IMAGE_BASE_URL}/${resolvedFilename}`;

  return {
    sortOrder: 0,
    isPrimary: true,
    imageAsset: {
      create: {
        sourceType: 'POST',
        storageKey: `seeds/posts/${filename}`,
        originalImageUrl: url,
        processedImageUrl: url,
        thumbnailUrl: url,
        blurMethod: BlurMethod.NONE,
        aiBlurStatus: AiBlurStatus.DONE,
      },
    },
  };
}

function buildDistributedDates(start, end, count) {
  const startMs = start.getTime();
  const endMs = end.getTime();

  if (count <= 0) {
    return [];
  }

  if (endMs <= startMs) {
    return Array.from({ length: count }, (_, index) => {
      const value = new Date(start);
      value.setMinutes(value.getMinutes() + index);
      return value;
    });
  }

  const step = (endMs - startMs) / (count + 1);

  return Array.from({ length: count }, (_, index) => new Date(startMs + step * (index + 1)));
}

function getVoterKeysExcludingAuthor(authorKey) {
  return ALL_USER_KEYS.filter((key) => key !== authorKey).slice(0, 3);
}

async function upsertUsers() {
  const userMap = {};

  for (const seed of userSeeds) {
    const passwordHash = await bcrypt.hash(seed.password, 10);

    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: {
        nickname: seed.nickname,
        passwordHash,
        gender: seed.gender,
        birthDate: seed.birthDate,
        phoneNumber: seed.phoneNumber,
        role: seed.role ?? UserRole.USER,
      },
      create: {
        email: seed.email,
        nickname: seed.nickname,
        passwordHash,
        gender: seed.gender,
        birthDate: seed.birthDate,
        phoneNumber: seed.phoneNumber,
        role: seed.role ?? UserRole.USER,
      },
    });

    userMap[seed.key] = user;
  }

  return userMap;
}

async function upsertKeywords() {
  const keywordMap = {};

  for (const seed of keywordSeeds) {
    const keyword = await prisma.keyword.upsert({
      where: { code: seed.code },
      update: {
        label: seed.label,
        sortOrder: seed.sortOrder,
        isActive: true,
      },
      create: {
        ...seed,
        isActive: true,
      },
    });

    keywordMap[seed.code] = keyword;
  }

  return keywordMap;
}

async function upsertFeedbackTags() {
  const tagMap = {};

  for (const seed of feedbackTagSeeds) {
    const tag = await prisma.feedbackTag.upsert({
      where: { code: seed.code },
      update: {
        label: seed.label,
        groupCode: seed.groupCode,
        voteChoice: seed.voteChoice,
        isActive: seed.isActive,
        sortOrder: seed.sortOrder,
      },
      create: seed,
    });

    tagMap[seed.code] = tag;
  }

  return tagMap;
}

async function resetSampleData() {
  await prisma.rankingDetail.deleteMany();
  await prisma.ranking.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.bookmark.deleteMany();
  await prisma.report.deleteMany();
  await prisma.userReport.deleteMany();
  await prisma.postSearchIndex.deleteMany();
  await prisma.searchHistory.deleteMany();
  await prisma.imageVector.deleteMany();
  await prisma.imageGarment.deleteMany();
  await prisma.imageAnalysisRun.deleteMany();
  await prisma.postKeyword.deleteMany();
  await prisma.postOutfit.deleteMany();
  await prisma.postImage.deleteMany();
  await prisma.post.deleteMany();
  await prisma.imageAsset.deleteMany({ where: { sourceType: 'POST' } });
  await prisma.userSession.deleteMany();
}

async function createOpenPost(seed, now, userMap, keywordMap) {
  return prisma.post.create({
    data: {
      authorId: userMap[seed.authorKey].id,
      content: seed.content,
      images: {
        create: buildImageCreate(seed.imageName),
      },
      postKeywords: {
        create: seed.keywordCodes.map((keywordCode, index) => ({
          keywordId: keywordMap[keywordCode].id,
          sortOrder: index,
        })),
      },
      outfitItems: {
        create: seed.outfitItems.map((item, index) => ({
          ...item,
          sortOrder: index,
        })),
      },
      evaluation: {
        create: {
          startsAt: addDays(now, seed.openOffsetDays.start),
          endsAt: addDays(now, seed.openOffsetDays.end),
          status: EvaluationStatus.OPEN,
        },
      },
    },
    include: {
      evaluation: true,
    },
  });
}

async function createRankedPost(seed, publishAt, userMap, keywordMap) {
  return prisma.post.create({
    data: {
      authorId: userMap[seed.authorKey].id,
      content: seed.content,
      publishedAt: publishAt,
      images: {
        create: buildImageCreate(seed.imageName),
      },
      postKeywords: {
        create: seed.keywordCodes.map((keywordCode, index) => ({
          keywordId: keywordMap[keywordCode].id,
          sortOrder: index,
        })),
      },
      outfitItems: {
        create: seed.outfitItems.map((item, index) => ({
          ...item,
          sortOrder: index,
        })),
      },
      evaluation: {
        create: {
          startsAt: addDays(publishAt, -7),
          endsAt: publishAt,
          status: EvaluationStatus.ENDED,
          closedAt: publishAt,
          closeReason: 'AUTO_ENDED',
        },
      },
    },
    include: {
      evaluation: true,
    },
  });
}

async function seedVotesAndFeedback(post, seed, now, userMap, tagMap) {
  const profile = PROFILE_CONFIG[seed.profile];
  const voterKeys = getVoterKeysExcludingAuthor(seed.authorKey);

  for (const [index, voterKey] of voterKeys.entries()) {
    const vote = await prisma.vote.create({
      data: {
        evaluationId: post.evaluation.id,
        voterId: userMap[voterKey].id,
        choice: profile.choices[index],
        feedbackSubmittedAt: now,
      },
    });

    await prisma.feedback.create({
      data: {
        voteId: vote.id,
        tagId: tagMap[profile.tagCodes[index]].id,
        sortOrder: 0,
      },
    });
  }

  return profile;
}


async function syncPostSearchIndexRecord(postId) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      author: { select: { nickname: true } },
      postKeywords: {
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: { keyword: { select: { code: true, label: true } } },
      },
      outfitItems: {
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: { category: true, itemName: true, brand: true },
      },
      evaluation: {
        include: {
          votes: {
            include: {
              feedbacks: {
                include: {
                  tag: { select: { code: true, voteChoice: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!post) {
    return;
  }

  const votes = post.evaluation?.votes ?? [];
  const likeCount = votes.filter((vote) => vote.choice === VoteChoice.LIKE).length;
  const totalCount = votes.length;
  const likeRatio = totalCount === 0 ? 0 : likeCount / totalCount;

  const keywordCodes = [...new Set(post.postKeywords.map((item) => item.keyword.code))];
  const keywordLabels = [...new Set(post.postKeywords.map((item) => item.keyword.label))];
  const outfitCategories = [
    ...new Set(post.outfitItems.map((item) => String(item.category).trim().toUpperCase())),
  ];

  const feedbackLikeCodes = [
    ...new Set(
      votes
        .flatMap((vote) => vote.feedbacks)
        .filter((feedback) => feedback.tag.voteChoice === VoteChoice.LIKE)
        .map((feedback) => feedback.tag.code),
    ),
  ];

  const feedbackDislikeCodes = [
    ...new Set(
      votes
        .flatMap((vote) => vote.feedbacks)
        .filter((feedback) => feedback.tag.voteChoice === VoteChoice.DISLIKE)
        .map((feedback) => feedback.tag.code),
    ),
  ];

  const searchText = [
    post.content,
    post.author.nickname,
    ...keywordLabels,
    ...post.outfitItems.flatMap((item) => [item.category, item.itemName, item.brand]),
  ]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .join(' ');

  const isSearchable =
    post.status === 'ACTIVE' &&
    post.deletedAt === null &&
    post.hiddenAt === null &&
    post.publishedAt !== null &&
    post.evaluation?.status === EvaluationStatus.ENDED;

  await prisma.postSearchIndex.upsert({
    where: { postId: post.id },
    update: {
      authorNickname: post.author.nickname,
      searchText,
      keywordCodes,
      outfitCategories,
      feedbackLikeCodes,
      feedbackDislikeCodes,
      likeRatio,
      isSearchable,
      indexedAt: new Date(),
    },
    create: {
      postId: post.id,
      authorNickname: post.author.nickname,
      searchText,
      keywordCodes,
      outfitCategories,
      feedbackLikeCodes,
      feedbackDislikeCodes,
      likeRatio,
      isSearchable,
      indexedAt: new Date(),
    },
  });
}

async function createSamplePosts(userMap, keywordMap, tagMap) {
  const now = new Date();

  const weeklyRankingStart = startOfWeek(now);
  const weeklyRankingEnd = endOfWeek(now);
  const monthlyRankingStart = startOfMonth(now);
  const monthlyRankingEnd = endOfMonth(now);

  const openPosts = [];
  for (const seed of OPEN_POST_SEEDS) {
    const post = await createOpenPost(seed, now, userMap, keywordMap);
    await syncPostSearchIndexRecord(post.id);
    openPosts.push(post);
  }

  const weeklyPublishDates = buildDistributedDates(
    setTime(weeklyRankingStart, 9, 0),
    minDate(now, weeklyRankingEnd),
    WEEKLY_RANKING_SEEDS.length,
  );

  const monthlyPublishDates = buildDistributedDates(
    setTime(monthlyRankingStart, 8, 30),
    minDate(now, monthlyRankingEnd),
    MONTHLY_RANKING_SEEDS.length,
  );

  const weeklyRankingPosts = [];
  for (const [index, seed] of WEEKLY_RANKING_SEEDS.entries()) {
    const post = await createRankedPost(seed, weeklyPublishDates[index], userMap, keywordMap);
    const profile = await seedVotesAndFeedback(post, seed, now, userMap, tagMap);
    await syncPostSearchIndexRecord(post.id);

    weeklyRankingPosts.push({
      post,
      profile,
    });
  }

  const monthlyRankingPosts = [];
  for (const [index, seed] of MONTHLY_RANKING_SEEDS.entries()) {
    const post = await createRankedPost(seed, monthlyPublishDates[index], userMap, keywordMap);
    const profile = await seedVotesAndFeedback(post, seed, now, userMap, tagMap);
    await syncPostSearchIndexRecord(post.id);

    monthlyRankingPosts.push({
      post,
      profile,
    });
  }

  const weeklyRanking = await prisma.ranking.create({
    data: {
      period: RankingPeriod.WEEKLY,
      startDate: weeklyRankingStart,
      endDate: weeklyRankingEnd,
      status: RankingStatus.READY,
      generatedAt: now,
    },
  });

  const monthlyRanking = await prisma.ranking.create({
    data: {
      period: RankingPeriod.MONTHLY,
      startDate: monthlyRankingStart,
      endDate: monthlyRankingEnd,
      status: RankingStatus.READY,
      generatedAt: now,
    },
  });

  await prisma.rankingDetail.createMany({
    data: weeklyRankingPosts.map(({ post, profile }, index) => ({
      rankingId: weeklyRanking.id,
      postId: post.id,
      rank: index + 1,
      score: profile.score,
      likeCount: profile.likeCount,
      dislikeCount: profile.dislikeCount,
      totalCount: profile.totalCount,
      likeRate: profile.likeRate,
    })),
  });

  await prisma.rankingDetail.createMany({
    data: monthlyRankingPosts.map(({ post, profile }, index) => ({
      rankingId: monthlyRanking.id,
      postId: post.id,
      rank: index + 1,
      score: profile.score,
      likeCount: profile.likeCount,
      dislikeCount: profile.dislikeCount,
      totalCount: profile.totalCount,
      likeRate: profile.likeRate,
    })),
  });

  return {
    now,
    openPostCount: openPosts.length,
    weeklyRankingPostCount: weeklyRankingPosts.length,
    monthlyRankingPostCount: monthlyRankingPosts.length,
  };
}

async function main() {
  const userMap = await upsertUsers();
  const keywordMap = await upsertKeywords();
  const tagMap = await upsertFeedbackTags();

  await resetSampleData();
  const result = await createSamplePosts(userMap, keywordMap, tagMap);

  console.log('✅ prisma seed 완료');
  console.log(result);
}

main()
  .catch((error) => {
    console.error('❌ prisma seed 실패');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });