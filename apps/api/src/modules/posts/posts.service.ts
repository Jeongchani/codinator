import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  CreatePostRequest,
  CreatePostResponse,
  DeletePostResponse,
  GetPostDetailResponse,
  HidePostResponse,
  UnhidePostResponse,
  UpdatePostRequest,
  UpdatePostResponse,
} from '@codinator/contracts';
import {
  AiBlurStatus,
  BlurMethod,
  EvaluationStatus,
  GarmentCategory,
  PostStatus,
  Prisma,
  RankingStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildFeedbackSummary,
  buildMyVoteContext,
  buildVoteSummary,
} from '../evaluations/common/evaluation-summary.util';
import { syncExpiredEvaluations } from '../evaluations/common/sync-expired-evaluations.util';
import {
  IMAGE_ORDER_BY,
  mapOutfitItems,
  mapPostImages,
  mapPostKeywords,
  OUTFIT_ORDER_BY,
  POST_KEYWORD_ORDER_BY,
} from './common/post-presenter.util';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPost(
    authorId: number,
    body: CreatePostRequest,
  ): Promise<CreatePostResponse> {
    if (!body.content || !body.content.trim()) {
      throw new BadRequestException('게시글 내용(content)은 필수입니다.');
    }

    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setDate(endsAt.getDate() + 7);

    const keywordIds = this.normalizeKeywordIds(body.keywordIds);
    const validKeywordIds = await this.loadValidKeywordIds(keywordIds);

    const post = await this.prisma.post.create({
      data: {
        authorId,
        content: body.content,
        images: {
          create: {
            originalImageUrl: body.image.originalImageUrl,
            processedImageUrl:
              body.image.processedImageUrl ?? body.image.originalImageUrl,
            storageKey: body.image.storageKey ?? null,
            thumbnailUrl: body.image.thumbnailUrl ?? null,
            blurMethod: body.image.blurMethod ?? BlurMethod.NONE,
            aiBlurStatus: body.image.aiBlurStatus ?? AiBlurStatus.NONE,
            sortOrder: 0,
            isPrimary: true,
          },
        },
        postKeywords: validKeywordIds.length
          ? {
              create: validKeywordIds.map((keywordId, index) => ({
                keywordId,
                sortOrder: index,
              })),
            }
          : undefined,
        outfitItems: body.outfitItems?.length
          ? {
              create: body.outfitItems.map((item, index) => ({
                category: item.category,
                itemName: item.itemName ?? null,
                brand: item.brand ?? null,
                sortOrder: index,
              })),
            }
          : undefined,
        evaluation: {
          create: {
            startsAt: now,
            endsAt,
            status: EvaluationStatus.OPEN,
          },
        },
      },
      include: {
        evaluation: true,
      },
    });

    return {
      postId: post.id,
      evaluationId: post.evaluation!.id,
      status: post.status,
    };
  }

  async updatePost(
    userId: number,
    postId: number,
    body: UpdatePostRequest,
  ): Promise<UpdatePostResponse> {
    const wantsContentUpdate = body.content !== undefined;
    const wantsOutfitUpdate = body.outfitItems !== undefined;

    if (!wantsContentUpdate && !wantsOutfitUpdate) {
      throw new BadRequestException('수정할 내용을 1개 이상 입력해주세요.');
    }

    const normalizedContent = this.normalizeUpdatableContent(body.content);

    return this.prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { id: postId },
        include: {
          evaluation: true,
          outfitItems: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      if (!post || post.status === PostStatus.DELETED || post.deletedAt) {
        throw new NotFoundException('게시글을 찾을 수 없습니다.');
      }

      if (post.authorId !== userId) {
        throw new ForbiddenException('본인 게시글만 수정할 수 있습니다.');
      }

      if (post.status !== PostStatus.ACTIVE) {
        throw new UnprocessableEntityException(
          '현재 상태의 게시글은 수정할 수 없습니다.',
        );
      }

      if (!post.evaluation) {
        throw new UnprocessableEntityException(
          '게시글 평가 상태를 확인할 수 없습니다.',
        );
      }

      if (
        normalizedContent !== undefined &&
        post.evaluation.status === EvaluationStatus.OPEN
      ) {
        throw new BadRequestException(
          '평가 진행 중에는 본문을 수정할 수 없습니다.',
        );
      }

      if (
        normalizedContent !== undefined &&
        post.evaluation.status !== EvaluationStatus.ENDED &&
        post.evaluation.status !== EvaluationStatus.CLOSED
      ) {
        throw new UnprocessableEntityException(
          '현재 평가 상태에서는 본문을 수정할 수 없습니다.',
        );
      }

      let nextOutfitItems = this.mapUpdatedOutfitItems(post.outfitItems);

      if (wantsOutfitUpdate) {
        await tx.postOutfit.deleteMany({
          where: { postId: post.id },
        });

        const requestOutfitItems = body.outfitItems ?? [];

        if (requestOutfitItems.length > 0) {
          await tx.postOutfit.createMany({
            data: requestOutfitItems.map((item, index) => ({
              postId: post.id,
              category: item.category,
              itemName: item.itemName?.trim() || null,
              brand: item.brand?.trim() || null,
              sortOrder: index,
            })),
          });
        }

        nextOutfitItems = requestOutfitItems.map((item, index) => ({
          category: item.category,
          itemName: item.itemName?.trim() || null,
          brand: item.brand?.trim() || null,
          sortOrder: index,
        }));
      }

      const updateData: Prisma.PostUpdateInput = {};

      if (normalizedContent !== undefined) {
        updateData.content = normalizedContent;
      }

      if (wantsOutfitUpdate && normalizedContent === undefined) {
        updateData.updatedAt = new Date();
      }

      const updatedPost = await tx.post.update({
        where: { id: post.id },
        data: updateData,
        select: {
          id: true,
          content: true,
          updatedAt: true,
        },
      });

      return {
        postId: updatedPost.id,
        content: updatedPost.content,
        outfitItems: nextOutfitItems,
        updatedAt: updatedPost.updatedAt.toISOString(),
      };
    });
  }

  // ─── 게시글 삭제 (소프트 삭제) ───────────────────────────────────────────────

  async deletePost(userId: number, postId: number): Promise<DeletePostResponse> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, status: true, deletedAt: true },
    });

    if (!post || post.status === PostStatus.DELETED || post.deletedAt) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('본인 게시글만 삭제할 수 있습니다.');
    }

    await this.prisma.post.update({
      where: { id: postId },
      data: { status: PostStatus.DELETED, deletedAt: new Date() },
    });

    return { success: true };
  }

  // ─── 게시글 숨기기 (작성자) ──────────────────────────────────────────────────────
  /**
   * PATCH /posts/:postId/hide
   * V2 정책: 작성자가 직접 게시글을 숨긴다.
   *
   * 숨김 가능 조건 (아래 셋 모두 만족):
   *   ① post.status === ACTIVE
   *   ② evaluation.status === ENDED  — 평가 완료된 게시글만 허용 (OPEN 불가)
   *   ③ rankingDetails 에 READY 상태 랭킹 등재 1건 이상 존재
   *
   * 처리 결과:
   *   - post.status → HIDDEN (공개 피드/검색에서 제외, 본인 피드에서는 계속 조회 가능)
   *   - hiddenAt 기록
   *   - evaluation.status → 변경하지 않음 (ENDED 유지)
   */
  async hidePost(userId: number, postId: number): Promise<HidePostResponse> {
    return this.prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { id: postId },
        include: {
          evaluation: { select: { id: true, status: true } },
          rankingDetails: {
            where: { ranking: { status: RankingStatus.READY } },
            take: 1,
            select: { id: true },
          },
        },
      });

      if (!post || post.status === PostStatus.DELETED || post.deletedAt) {
        throw new NotFoundException('게시글을 찾을 수 없습니다.');
      }

      if (post.authorId !== userId) {
        throw new ForbiddenException('본인 게시글만 숨길 수 있습니다.');
      }

      if (post.status === PostStatus.HIDDEN) {
        throw new BadRequestException('이미 숨긴 게시글입니다.');
      }

      // ② 평가 완료(ENDED) 상태인지 확인 — OPEN 은 숨김 불가
      if (!post.evaluation || post.evaluation.status !== EvaluationStatus.ENDED) {
        throw new BadRequestException(
          '평가가 완료(ENDED)된 게시글만 숨길 수 있습니다. 평가 중(OPEN)인 게시글은 숨길 수 없습니다.',
        );
      }

      // ③ 랭킹 등재 확인
      if (post.rankingDetails.length === 0) {
        throw new BadRequestException(
          '랭킹에 등재된 게시글만 숨길 수 있습니다.',
        );
      }

      // post 상태를 HIDDEN 으로 변경 (evaluation.status 는 ENDED 유지)
      await tx.post.update({
        where: { id: postId },
        data: { status: PostStatus.HIDDEN, hiddenAt: new Date() },
      });

      return { postId, hidden: true };
    });
  }

  // ─── 게시글 숨김 취소 (작성자) ───────────────────────────────────────────────────
  /**
   * PATCH /posts/:postId/unhide
   * V2 정책: 작성자가 직접 숨긴 게시글을 다시 공개한다.
   *
   * 숨김 취소 가능 조건:
   *   - post.status === HIDDEN
   *
   * 처리 결과:
   *   - post.status → ACTIVE (공개 피드/검색에 다시 노출)
   *   - hiddenAt → null
   *   - evaluation.status → 변경하지 않음 (ENDED 유지)
   */
  async unhidePost(userId: number, postId: number): Promise<UnhidePostResponse> {
    return this.prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { id: postId },
        select: { id: true, authorId: true, status: true, deletedAt: true },
      });

      if (!post || post.status === PostStatus.DELETED || post.deletedAt) {
        throw new NotFoundException('게시글을 찾을 수 없습니다.');
      }

      if (post.authorId !== userId) {
        throw new ForbiddenException('본인 게시글만 숨김 취소할 수 있습니다.');
      }

      if (post.status !== PostStatus.HIDDEN) {
        throw new BadRequestException('숨김 상태의 게시글만 숨김 취소할 수 있습니다.');
      }

      // post 상태를 ACTIVE 로 복원 (evaluation.status 는 ENDED 유지)
      await tx.post.update({
        where: { id: postId },
        data: { status: PostStatus.ACTIVE, hiddenAt: null },
      });

      return { postId, hidden: false };
    });
  }

  async getMyPostDetail(
    postId: number,
    userId: number,
  ): Promise<GetPostDetailResponse> {
    await syncExpiredEvaluations(this.prisma);

    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        authorId: userId,
        // 소유자는 HIDDEN 게시글도 조회 가능 (DELETED만 제외)
        status: { not: PostStatus.DELETED },
        deletedAt: null,
      },
      include: {
        author: {
          select: {
            id: true,
            nickname: true,
          },
        },
        images: {
          orderBy: IMAGE_ORDER_BY,
        },
        outfitItems: {
          orderBy: OUTFIT_ORDER_BY,
        },
        postKeywords: {
          orderBy: POST_KEYWORD_ORDER_BY,
          include: {
            keyword: true,
          },
        },
        evaluation: {
          include: {
            votes: {
              include: {
                feedbacks: {
                  include: {
                    tag: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!post || !post.evaluation) {
      throw new NotFoundException('내 게시글을 찾을 수 없습니다.');
    }

    return {
      postId: post.id,
      author: {
        userId: post.author.id,
        nickname: post.author.nickname,
      },
      content: post.content,
      status: post.status,
      createdAt: post.createdAt.toISOString(),
      images: mapPostImages(post.images),
      keywords: mapPostKeywords(post.postKeywords),
      outfitItems: mapOutfitItems(post.outfitItems),
      evaluation: {
        id: post.evaluation.id,
        status: post.evaluation.status,
        endsAt: post.evaluation.endsAt.toISOString(),
      },
      ...buildMyVoteContext(post.evaluation.votes, userId),
      voteSummary: buildVoteSummary(post.evaluation.votes),
      feedbackSummary: buildFeedbackSummary(post.evaluation.votes),
    };
  }

  private normalizeKeywordIds(keywordIds?: number[]): number[] {
    if (!keywordIds?.length) {
      return [];
    }

    const normalized = keywordIds.map((value) => Number(value));

    if (normalized.some((value) => !Number.isInteger(value) || value <= 0)) {
      throw new BadRequestException(
        'keywordIds는 양의 정수 배열이어야 합니다.',
      );
    }

    const unique = Array.from(new Set(normalized));

    if (unique.length !== normalized.length) {
      throw new BadRequestException('중복된 키워드는 선택할 수 없습니다.');
    }

    return unique;
  }

  private async loadValidKeywordIds(keywordIds: number[]): Promise<number[]> {
    if (keywordIds.length === 0) {
      return [];
    }

    const keywords = await this.prisma.keyword.findMany({
      where: {
        id: { in: keywordIds },
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (keywords.length !== keywordIds.length) {
      throw new BadRequestException('유효하지 않은 키워드가 포함되어 있습니다.');
    }

    return keywordIds;
  }

  private normalizeUpdatableContent(content?: string): string | undefined {
    if (content === undefined) {
      return undefined;
    }

    const normalized = content.trim();

    if (!normalized) {
      throw new BadRequestException('content는 빈 문자열일 수 없습니다.');
    }

    return normalized;
  }

  private mapUpdatedOutfitItems(
    items: Array<{
      category: GarmentCategory;
      itemName: string | null;
      brand: string | null;
      sortOrder: number;
    }>,
  ): UpdatePostResponse['outfitItems'] {
    return items.map((item) => ({
      category: item.category,
      itemName: item.itemName ?? null,
      brand: item.brand ?? null,
      sortOrder: item.sortOrder,
    }));
  }
}
