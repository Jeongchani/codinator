import {
  PrismaClient,
  Prisma,
  EvaluationStatus,
  FeedbackTagPolarity,
  GarmentCategory,
  RankingPeriod,
  VoteChoice,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const userSeeds = [
  { key: 'alice', email: 'alice@codinator.com', nickname: '앨리스', password: '1234' },
  { key: 'bob', email: 'bob@codinator.com', nickname: '밥', password: '1234' },
  { key: 'charlie', email: 'charlie@codinator.com', nickname: '찰리', password: '1234' },
  { key: 'diana', email: 'diana@codinator.com', nickname: '다이애나', password: '1234' },
];

const feedbackTagSeeds = [
  {
    code: 'POS_FIT_GOOD',
    label: '핏이 좋아요',
    polarity: FeedbackTagPolarity.POSITIVE,
    voteChoice: VoteChoice.LIKE,
    isActive: true,
    sortOrder: 1,
  },
  {
    code: 'POS_POINT_GOOD',
    label: '포인트가 좋아요',
    polarity: FeedbackTagPolarity.POSITIVE,
    voteChoice: VoteChoice.LIKE,
    isActive: true,
    sortOrder: 2,
  },
  {
    code: 'NEG_SIZE_BAD',
    label: '핏/사이즈가 아쉬워요',
    polarity: FeedbackTagPolarity.NEGATIVE,
    voteChoice: VoteChoice.DISLIKE,
    isActive: true,
    sortOrder: 3,
  },
  {
    code: 'NEG_COLOR_BAD',
    label: '색 조합이 아쉬워요',
    polarity: FeedbackTagPolarity.NEGATIVE,
    voteChoice: VoteChoice.DISLIKE,
    isActive: true,
    sortOrder: 4,
  },
  {
    code: 'NEG_MATCHING_BAD',
    label: '아이템 매치가 어색해요',
    polarity: FeedbackTagPolarity.NEGATIVE,
    voteChoice: VoteChoice.DISLIKE,
    isActive: true,
    sortOrder: 5,
  },
];

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function subDays(date, days) {
  return addDays(date, -days);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
      },
      create: {
        email: seed.email,
        nickname: seed.nickname,
        passwordHash,
      },
    });

    userMap[seed.key] = user;
  }

  return userMap;
}

async function upsertFeedbackTags() {
  const tagMap = {};

  for (const seed of feedbackTagSeeds) {
    const tag = await prisma.feedbackTag.upsert({
      where: { code: seed.code },
      update: {
        label: seed.label,
        polarity: seed.polarity,
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
  await prisma.voteFeedbackTag.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.rankingEntry.deleteMany();
  await prisma.rankingSnapshot.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.postOutfitItem.deleteMany();
  await prisma.postImage.deleteMany();
  await prisma.post.deleteMany();
}

async function createSamplePosts(userMap, tagMap) {
  const now = new Date();

  const openPost = await prisma.post.create({
    data: {
      authorId: userMap.alice.id,
      content: '[SEED] 봄 데일리 코디 평가 부탁드립니다.',
      images: {
        create: [
          {
            imageUrl: 'https://images.example.com/posts/open-post.jpg',
          },
        ],
      },
      outfitItems: {
        create: [
          {
            category: GarmentCategory.TOP,
            itemName: '화이트 셔츠',
            brand: 'SPAO',
          },
          {
            category: GarmentCategory.BOTTOM,
            itemName: '와이드 데님',
            brand: 'MUSINSA STANDARD',
          },
          {
            category: GarmentCategory.SHOES,
            itemName: '스니커즈',
            brand: 'CONVERSE',
          },
        ],
      },
      evaluation: {
        create: {
          startsAt: subDays(now, 1),
          endsAt: addDays(now, 6),
          status: EvaluationStatus.OPEN,
        },
      },
    },
    include: {
      evaluation: true,
    },
  });

  const rankedPost1 = await prisma.post.create({
    data: {
      authorId: userMap.bob.id,
      content: '[SEED] 스트릿 코디 랭킹 테스트용 게시글 1',
      images: {
        create: [
          {
            imageUrl: 'https://images.example.com/posts/ranked-post-1.jpg',
          },
        ],
      },
      outfitItems: {
        create: [
          {
            category: GarmentCategory.OUTER,
            itemName: '블랙 레더 자켓',
            brand: 'ZARA',
          },
          {
            category: GarmentCategory.TOP,
            itemName: '그래픽 티셔츠',
            brand: 'THISISNEVERTHAT',
          },
          {
            category: GarmentCategory.BOTTOM,
            itemName: '카고 팬츠',
            brand: 'CARHARTT',
          },
        ],
      },
      evaluation: {
        create: {
          startsAt: subDays(now, 14),
          endsAt: subDays(now, 7),
          status: EvaluationStatus.ENDED,
        },
      },
    },
    include: {
      evaluation: true,
    },
  });

  const rankedPost2 = await prisma.post.create({
    data: {
      authorId: userMap.diana.id,
      content: '[SEED] 랭킹 테스트용 게시글 2',
      images: {
        create: [
          {
            imageUrl: 'https://images.example.com/posts/ranked-post-2.jpg',
          },
        ],
      },
      outfitItems: {
        create: [
          {
            category: GarmentCategory.TOP,
            itemName: '니트',
            brand: '8SECONDS',
          },
          {
            category: GarmentCategory.BOTTOM,
            itemName: '슬랙스',
            brand: 'UNIQLO',
          },
          {
            category: GarmentCategory.BAG,
            itemName: '크로스백',
            brand: 'MATIN KIM',
          },
        ],
      },
      evaluation: {
        create: {
          startsAt: subDays(now, 12),
          endsAt: subDays(now, 5),
          status: EvaluationStatus.ENDED,
        },
      },
    },
    include: {
      evaluation: true,
    },
  });

  const vote1 = await prisma.vote.create({
    data: {
      evaluationId: rankedPost1.evaluation.id,
      voterId: userMap.alice.id,
      choice: VoteChoice.LIKE,
    },
  });

  const vote2 = await prisma.vote.create({
    data: {
      evaluationId: rankedPost1.evaluation.id,
      voterId: userMap.charlie.id,
      choice: VoteChoice.LIKE,
    },
  });

  const vote3 = await prisma.vote.create({
    data: {
      evaluationId: rankedPost1.evaluation.id,
      voterId: userMap.diana.id,
      choice: VoteChoice.DISLIKE,
    },
  });

  const vote4 = await prisma.vote.create({
    data: {
      evaluationId: rankedPost2.evaluation.id,
      voterId: userMap.alice.id,
      choice: VoteChoice.LIKE,
    },
  });

  const vote5 = await prisma.vote.create({
    data: {
      evaluationId: rankedPost2.evaluation.id,
      voterId: userMap.bob.id,
      choice: VoteChoice.DISLIKE,
    },
  });

  await prisma.voteFeedbackTag.createMany({
    data: [
      {
        voteId: vote1.id,
        tagId: tagMap.POS_FIT_GOOD.id,
      },
      {
        voteId: vote2.id,
        tagId: tagMap.POS_POINT_GOOD.id,
      },
      {
        voteId: vote3.id,
        tagId: tagMap.NEG_COLOR_BAD.id,
      },
      {
        voteId: vote4.id,
        tagId: tagMap.POS_POINT_GOOD.id,
      },
      {
        voteId: vote5.id,
        tagId: tagMap.NEG_MATCHING_BAD.id,
      },
    ],
  });

  const weeklyStart = startOfDay(subDays(now, 7));
  const weeklyEnd = startOfDay(subDays(now, 1));
  const monthlyStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthlyEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  await prisma.rankingSnapshot.create({
    data: {
      period: RankingPeriod.WEEKLY,
      startDate: weeklyStart,
      endDate: weeklyEnd,
      entries: {
        create: [
          {
            postId: rankedPost1.id,
            rank: 1,
            likeCount: 2,
            dislikeCount: 1,
            totalCount: 3,
            likeRate: new Prisma.Decimal('0.6667'),
          },
          {
            postId: rankedPost2.id,
            rank: 2,
            likeCount: 1,
            dislikeCount: 1,
            totalCount: 2,
            likeRate: new Prisma.Decimal('0.5000'),
          },
        ],
      },
    },
  });

  await prisma.rankingSnapshot.create({
    data: {
      period: RankingPeriod.MONTHLY,
      startDate: monthlyStart,
      endDate: monthlyEnd,
      entries: {
        create: [
          {
            postId: rankedPost1.id,
            rank: 1,
            likeCount: 2,
            dislikeCount: 1,
            totalCount: 3,
            likeRate: new Prisma.Decimal('0.6667'),
          },
          {
            postId: rankedPost2.id,
            rank: 2,
            likeCount: 1,
            dislikeCount: 1,
            totalCount: 2,
            likeRate: new Prisma.Decimal('0.5000'),
          },
        ],
      },
    },
  });

  return {
    openPostId: openPost.id,
    rankedPost1Id: rankedPost1.id,
    rankedPost2Id: rankedPost2.id,
  };
}

async function main() {
  const userMap = await upsertUsers();
  const tagMap = await upsertFeedbackTags();

  await resetSampleData();

  const result = await createSamplePosts(userMap, tagMap);

  console.log('Seed completed');
  console.log(result);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });