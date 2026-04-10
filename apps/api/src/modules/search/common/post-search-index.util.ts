import { EvaluationStatus, Prisma, PostStatus, VoteChoice } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

function normalizeCategory(value: string): string {
  return value.trim().toUpperCase();
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export async function syncPostSearchIndex(
  prisma: PrismaService | Prisma.TransactionClient,
  postId: number,
): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      author: {
        select: {
          nickname: true,
        },
      },
      postKeywords: {
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: {
          keyword: {
            select: {
              code: true,
              label: true,
            },
          },
        },
      },
      outfitItems: {
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: {
          category: true,
          itemName: true,
          brand: true,
        },
      },
      evaluation: {
        include: {
          votes: {
            include: {
              feedbacks: {
                include: {
                  tag: {
                    select: {
                      code: true,
                      voteChoice: true,
                    },
                  },
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

  const feedbackLikeCodes = uniqueStrings(
    votes
      .flatMap((vote) => vote.feedbacks)
      .filter((feedback) => feedback.tag.voteChoice === VoteChoice.LIKE)
      .map((feedback) => feedback.tag.code),
  );

  const feedbackDislikeCodes = uniqueStrings(
    votes
      .flatMap((vote) => vote.feedbacks)
      .filter((feedback) => feedback.tag.voteChoice === VoteChoice.DISLIKE)
      .map((feedback) => feedback.tag.code),
  );

  const keywordCodes = uniqueStrings(post.postKeywords.map((item) => item.keyword.code));
  const keywordLabels = uniqueStrings(post.postKeywords.map((item) => item.keyword.label));
  const outfitCategories = uniqueStrings(
    post.outfitItems.map((item) => normalizeCategory(item.category)),
  );

  const searchTextParts = uniqueStrings([
    post.content,
    post.author.nickname,
    ...keywordLabels,
    ...post.outfitItems.flatMap((item) => [item.category, item.itemName, item.brand]),
  ]);

  const isSearchable =
    post.status === PostStatus.ACTIVE &&
    post.deletedAt === null &&
    post.hiddenAt === null &&
    post.publishedAt !== null &&
    post.evaluation?.status === EvaluationStatus.ENDED;

  await prisma.postSearchIndex.upsert({
    where: { postId: post.id },
    update: {
      authorNickname: post.author.nickname,
      searchText: searchTextParts.join(' '),
      keywordCodes,
      outfitCategories,
      feedbackLikeCodes,
      feedbackDislikeCodes,
      likeRatio: new Prisma.Decimal(likeRatio.toFixed(4)),
      isSearchable,
      indexedAt: new Date(),
    },
    create: {
      postId: post.id,
      authorNickname: post.author.nickname,
      searchText: searchTextParts.join(' '),
      keywordCodes,
      outfitCategories,
      feedbackLikeCodes,
      feedbackDislikeCodes,
      likeRatio: new Prisma.Decimal(likeRatio.toFixed(4)),
      isSearchable,
      indexedAt: new Date(),
    },
  });
}

export async function syncAuthorSearchIndexes(
  prisma: PrismaService | Prisma.TransactionClient,
  authorId: number,
): Promise<void> {
  const posts = await prisma.post.findMany({
    where: { authorId },
    select: { id: true },
  });

  for (const post of posts) {
    await syncPostSearchIndex(prisma, post.id);
  }
}
