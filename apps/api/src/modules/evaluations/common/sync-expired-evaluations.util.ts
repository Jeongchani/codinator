import { EvaluationStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export async function syncExpiredEvaluations(prisma: PrismaService): Promise<void> {
  await prisma.evaluation.updateMany({
    where: {
      status: EvaluationStatus.OPEN,
      endsAt: { lte: new Date() },
    },
    data: {
      status: EvaluationStatus.ENDED,
    },
  });
}
