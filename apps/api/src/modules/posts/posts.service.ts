import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
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
  ImageAnalysisPurpose,
  ImageAssetSourceType,
  PostStatus,
  SanctionType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildFeedbackSummary,
  buildMyVoteContext,
  buildVoteSummary,
} from '../evaluations/common/evaluation-summary.util';
import { syncExpiredEvaluations } from '../evaluations/common/sync-expired-evaluations.util';
import { syncPostSearchIndex } from '../search/common/post-search-index.util';
import {
  IMAGE_ORDER_BY,
  mapOutfitItems,
  mapPostImages,
  mapPostKeywords,
  OUTFIT_ORDER_BY,
  POST_IMAGE_INCLUDE,
  POST_KEYWORD_ORDER_BY,
} from './common/post-presenter.util';
import { ImageIndexingService } from '../ai/image-indexing.service';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imageIndexingService: ImageIndexingService,
  ) {}

  // ── POST /posts ──────────────────────────────────────────────────────────────

  async createPost(
    authorId: number,
    body: CreatePostRequest,
  ): Promise<CreatePostResponse> {
    const content = body.content?.trim();

    if (!content) {
      throw new BadRequestException('게시글 내용(content)은 필수입니다.');
    }

    // Batch5: POST_RESTRICTION 제재 대상 사용자 차단
    await this.assertNoPostRestriction(authorId);

    const keywordIds = this.normalizeKeywordIds(body.keywordIds);
    const validKeywordIds = await this.loadValidKeywordIds(keywordIds);

    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setDate(endsAt.getDate() + 7);

    const linkedImageAssetId = await this.resolvePostImageAssetId(authorId, body);

    const post = await this.prisma.post.create({
      data: {
        authorId,
        content,
        images: {
          create: {
            imageAssetId: linkedImageAssetId,
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
                itemName: item.itemName?.trim() || null,
                brand: item.brand?.trim() || null,
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

    await syncPostSearchIndex(this.prisma, post.id);

    try {
      await this.imageIndexingService.ensureCurrentAnalysisRun(
        linkedImageAssetId,
        ImageAnalysisPurpose.POST_INDEX,
      );
    } catch (error) {
      this.logger.error(
        `POST_INDEX 생성 실패 imageAssetId=${linkedImageAssetId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return {
      postId: post.id,
      evaluationId: post.evaluation!.id,
      status: post.status,
    };
  }

  // ── PATCH /posts/:postId ─────────────────────────────────────────────────────
  // Batch5: V3 정책 — outfitItems 중심 수정. content / imageAssetId / keywordIds 수정 불가.

  async updatePost(
    userId: number,
    postId: number,
    body: UpdatePostRequest,
  ): Promise<UpdatePostResponse> {
    // Batch5: outfitItems 필수
    if (body.outfitItems === undefined) {
      throw new BadRequestException('수정할 내용(outfitItems)을 입력해주세요.');
    }

    // Batch5: POST_RESTRICTION 제재 대상 사용자 차단
    await this.assertNoPostRestriction(userId);

    return this.prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { id: postId },
        select: {
          id: true,
          authorId: true,
          status: true,
          deletedAt: true,
        },
      });

      if (!post || post.status === PostStatus.DELETED || post.deletedAt) {
        throw new NotFoundException('게시글을 찾을 수 없습니다.');
      }

      if (post.authorId !== userId) {
        throw new ForbiddenException('본인 게시글만 수정할 수 있습니다.');
      }

      // Batch5: HIDDEN 상태 수정 불가
      if (post.status === PostStatus.HIDDEN) {
        throw new UnprocessableEntityException('숨김 상태의 게시글은 수정할 수 없습니다.');
      }

      // outfitItems 전체 교체
      await tx.postOutfit.deleteMany({ where: { postId } });

      if (body.outfitItems.length > 0) {
        await tx.postOutfit.createMany({
          data: body.outfitItems.map((item, index) => ({
            postId,
            category: item.category,
            itemName: item.itemName?.trim() || null,
            brand: item.brand?.trim() || null,
            sortOrder: index,
          })),
        });
      }

      // updatedAt 갱신 (@updatedAt 자동 처리)
      const updatedPost = await tx.post.update({
        where: { id: postId },
        data: { updatedAt: new Date() },
        select: { id: true, updatedAt: true },
      });

      await syncPostSearchIndex(tx, postId);

      const nextOutfitItems = body.outfitItems.map((item, index) => ({
        category: item.category,
        itemName: item.itemName?.trim() || null,
        brand: item.brand?.trim() || null,
        sortOrder: index,
      }));

      return {
        postId: updatedPost.id,
        outfitItems: nextOutfitItems,
        updatedAt: updatedPost.updatedAt.toISOString(),
      };
    });
  }

  // ── DELETE /posts/:postId ────────────────────────────────────────────────────
  // Batch5: 응답 shape V3 기준으로 보정 — { postId, status, deletedAt }

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

    const now = new Date();
    await this.prisma.post.update({
      where: { id: postId },
      data: { status: PostStatus.DELETED, deletedAt: now, hiddenAt: null },
    });

    await syncPostSearchIndex(this.prisma, postId);

    return {
      postId,
      status: 'DELETED',
      deletedAt: now.toISOString(),
    };
  }

  // ── PATCH /posts/:postId/hide ─────────────────────────────────────────────────
  // Batch5: hiddenById / hiddenReason 기록 추가, 응답 shape V3 보정

  async hidePost(userId: number, postId: number): Promise<HidePostResponse> {
    return this.prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { id: postId },
        include: {
          evaluation: { select: { id: true, status: true } },
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

      if (post.status !== PostStatus.ACTIVE) {
        throw new BadRequestException('ACTIVE 상태의 게시글만 숨길 수 있습니다.');
      }

      // Batch5: evaluation.status === ENDED 조건 (V3: rankingDetails 의존 없음)
      if (!post.evaluation || post.evaluation.status !== EvaluationStatus.ENDED) {
        throw new BadRequestException('평가가 완료(ENDED)된 게시글만 숨길 수 있습니다.');
      }

      const now = new Date();
      await tx.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.HIDDEN,
          hiddenAt: now,
          hiddenById: userId,        // Batch5: 작성자 직접 숨김 기록
          hiddenReason: 'USER_HIDE', // Batch5: 사유 기록
        },
      });

      await syncPostSearchIndex(tx, postId);

      return {
        postId,
        status: 'HIDDEN',
        hiddenAt: now.toISOString(),
      };
    });
  }

  // ── PATCH /posts/:postId/unhide ──────────────────────────────────────────────
  // Batch5: 작성자 직접 숨김만 복구 허용, hiddenBy 구분, 응답 shape V3 보정

  async unhidePost(userId: number, postId: number): Promise<UnhidePostResponse> {
    return this.prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { id: postId },
        select: {
          id: true,
          authorId: true,
          status: true,
          deletedAt: true,
          hiddenById: true,
        },
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

      // Batch5: 관리자 숨김은 이 API로 복구 불가
      // hiddenById === null: 구버전 데이터 or 작성자 숨김 → 허용
      // hiddenById === userId: 작성자 직접 숨김 → 허용
      // hiddenById !== null && !== userId: 관리자 숨김 → 불가
      if (post.hiddenById !== null && post.hiddenById !== userId) {
        throw new ForbiddenException('관리자에 의해 숨겨진 게시글은 이 API로 복구할 수 없습니다.');
      }

      const updated = await tx.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.ACTIVE,
          hiddenAt: null,
          hiddenById: null,    // Batch5: 초기화
          hiddenReason: null,  // Batch5: 초기화
        },
        select: { id: true, updatedAt: true },
      });

      await syncPostSearchIndex(tx, postId);

      return {
        postId,
        status: 'ACTIVE',
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }

  // ── GET /posts/me/:postId ────────────────────────────────────────────────────

  async getMyPostDetail(
    postId: number,
    userId: number,
  ): Promise<GetPostDetailResponse> {
    await syncExpiredEvaluations(this.prisma);

    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        authorId: userId,
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
          include: POST_IMAGE_INCLUDE,
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

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Batch5: 활성 POST_RESTRICTION 제재 확인.
   * startsAt <= now && (endsAt IS NULL || endsAt > now) 이면 제재 중.
   */
  private async assertNoPostRestriction(userId: number): Promise<void> {
    const now = new Date();
    const sanction = await this.prisma.userSanction.findFirst({
      where: {
        sanctionedUserId: userId,
        type: SanctionType.POST_RESTRICTION,
        startsAt: { lte: now },
        OR: [
          { endsAt: null },
          { endsAt: { gt: now } },
        ],
      },
      select: { id: true },
    });

    if (sanction) {
      throw new ForbiddenException('게시글 작성/수정이 제한된 계정입니다.');
    }
  }

  /**
   * V3 게시글 생성은 업로드 단계에서 생성된 POST imageAssetId만 허용한다.
   * 클라이언트가 이미지 URL/블러 상태를 직접 넣어 ImageAsset을 생성하는 legacy 경로는 차단한다.
   */
  private async resolvePostImageAssetId(
    authorId: number,
    body: CreatePostRequest,
  ): Promise<number> {
    const imageAssetId = Number(body.imageAssetId);

    if (!Number.isInteger(imageAssetId) || imageAssetId <= 0) {
      throw new BadRequestException('imageAssetId가 필요합니다.');
    }

    const existingAsset = await this.prisma.imageAsset.findFirst({
      where: {
        id: imageAssetId,
        ownerUserId: authorId,
        sourceType: ImageAssetSourceType.POST,
      },
      select: {
        id: true,
        aiBlurStatus: true,
        blurMethod: true,
      },
    });

    if (!existingAsset) {
      throw new BadRequestException('유효한 게시글 이미지 자산이 아닙니다.');
    }

    if (
      existingAsset.aiBlurStatus === AiBlurStatus.FAILED &&
      existingAsset.blurMethod !== BlurMethod.MANUAL
    ) {
      throw new BadRequestException('AI 블러 실패 이미지는 수동 블러 완료 후 게시글을 생성할 수 있습니다.');
    }

    return existingAsset.id;
  }

  private normalizeKeywordIds(keywordIds?: number[]): number[] {
    if (!keywordIds?.length) {
      return [];
    }

    const normalized = keywordIds.map((value) => Number(value));

    if (normalized.some((value) => !Number.isInteger(value) || value <= 0)) {
      throw new BadRequestException('keywordIds는 양의 정수 배열이어야 합니다.');
    }

    const unique = Array.from(new Set(normalized));

    if (unique.length !== normalized.length) {
      throw new BadRequestException('중복된 키워드는 선택할 수 없습니다.');
    }

    if (unique.length > 3) {
      throw new BadRequestException('키워드는 최대 3개까지 선택할 수 있습니다.');
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
}
