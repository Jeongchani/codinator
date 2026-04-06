import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AddBookmarkResponse,
  GetMyBookmarksResponse,
  RemoveBookmarkResponse,
} from '@codinator/contracts';
import { PostStatus, RankingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IMAGE_ORDER_BY } from '../posts/common/post-presenter.util';

@Injectable()
export class BookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── 북마크 추가 ──────────────────────────────────────────────────────────────

  async addBookmark(userId: number, postId: number): Promise<AddBookmarkResponse> {
    // 게시글 존재 확인 (DELETED 제외)
    const post = await this.prisma.post.findFirst({
      where: { id: postId, status: { not: PostStatus.DELETED }, deletedAt: null },
      select: { id: true },
    });

    if (!post) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    // 이미 북마크한 경우 기존 id 반환 (idempotent)
    const existing = await this.prisma.bookmark.findUnique({
      where: { userId_postId: { userId, postId } },
      select: { id: true },
    });

    if (existing) {
      return { bookmarkId: existing.id };
    }

    const bookmark = await this.prisma.bookmark.create({
      data: { userId, postId },
      select: { id: true },
    });

    return { bookmarkId: bookmark.id };
  }

  // ─── 북마크 삭제 ──────────────────────────────────────────────────────────────

  async removeBookmark(userId: number, postId: number): Promise<RemoveBookmarkResponse> {
    const bookmark = await this.prisma.bookmark.findUnique({
      where: { userId_postId: { userId, postId } },
      select: { id: true },
    });

    if (!bookmark) {
      throw new NotFoundException('북마크를 찾을 수 없습니다.');
    }

    await this.prisma.bookmark.delete({
      where: { id: bookmark.id },
    });

    return { success: true };
  }

  // ─── 내 북마크 목록 조회 (커서 페이지네이션) ─────────────────────────────────

  async getMyBookmarks(
    userId: number,
    params: { cursor?: number; limit?: number },
  ): Promise<GetMyBookmarksResponse> {
    const limit = this.normalizeLimit(params.limit);

    const bookmarks = await this.prisma.bookmark.findMany({
      where: {
        userId,
        // DELETED 게시글 북마크 제외
        post: { status: { not: PostStatus.DELETED }, deletedAt: null },
        ...(params.cursor !== undefined ? { id: { lt: params.cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      include: {
        post: {
          select: {
            id: true,
            content: true,
            status: true,
            images: {
              orderBy: IMAGE_ORDER_BY,
              take: 1,
              select: { processedImageUrl: true,originalImageUrl: true,},
            },
            // 평가 상태 포함
            evaluation: {
              select: {
                status: true,
                endsAt: true,
              },
            },
            // 랭킹 정보: READY 상태의 랭킹 중 가장 높은 순위
            rankingDetails: {
              where: {
                ranking: { status: RankingStatus.READY },
              },
              include: {
                ranking: { select: { period: true } },
              },
              orderBy: { rank: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    const hasMore = bookmarks.length > limit;
    const pageItems = hasMore ? bookmarks.slice(0, limit) : bookmarks;

    return {
      items: pageItems.map((b) => {
        const topRank = b.post.rankingDetails[0] ?? null;
        return {
          bookmarkId: b.id,
          postId: b.post.id,
          imageUrl:
          b.post.images[0]?.processedImageUrl ??
          b.post.images[0]?.originalImageUrl ??
          null,
          content: b.post.content,
          postStatus: b.post.status,
          evaluationStatus: b.post.evaluation?.status ?? null,
          evaluationEndsAt: b.post.evaluation?.endsAt.toISOString() ?? null,
          isRankingPublished: b.post.rankingDetails.length > 0,
          rankInfo: topRank
            ? { rank: topRank.rank, period: topRank.ranking.period }
            : null,
          bookmarkedAt: b.createdAt.toISOString(),
        };
      }),
      nextCursor: hasMore ? (pageItems[pageItems.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  // ─── private helpers ──────────────────────────────────────────────────────────

  private normalizeLimit(limit?: number): number {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed <= 0) return 20;
    return Math.min(parsed, 50);
  }
}
