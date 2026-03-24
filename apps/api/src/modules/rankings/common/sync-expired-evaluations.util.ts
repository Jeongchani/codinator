import { EvaluationStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { syncCurrentRankings } from '../../rankings/common/ranking-sync.util';

export async function syncExpiredEvaluations(prisma: PrismaService): Promise<void> {
  const now = new Date();

  const expiredEvaluations = await prisma.evaluation.findMany({
    where: {
      status: EvaluationStatus.OPEN,
      endsAt: { lte: now },
    },
    select: {
      id: true,
      postId: true,
    },
  });

  if (expiredEvaluations.length === 0) {
    return;
  }

  const evaluationIds = expiredEvaluations.map((evaluation) => evaluation.id);
  const postIds = expiredEvaluations.map((evaluation) => evaluation.postId);

  await prisma.$transaction([
    prisma.evaluation.updateMany({
      where: {
        id: { in: evaluationIds },
      },
      data: {
        status: EvaluationStatus.ENDED,
        closedAt: now,
        closeReason: 'AUTO_ENDED',
      },
    }),
    prisma.post.updateMany({
      where: {
        id: { in: postIds },
        publishedAt: null,
      },
      data: {
        publishedAt: now,
      },
    }),
  ]);

  await syncCurrentRankings(prisma);
}