import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { CreatePostResponse, GetPostDetailResponse } from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PostsService } from './posts.service';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '게시글 작성 및 평가 시작' })
  @ApiBody({ type: CreatePostDto })
  @ApiCreatedResponse({
    description: '게시글 생성 완료',
    schema: {
      example: {
        postId: 14,
        evaluationId: 7,
        status: 'ACTIVE',
      },
    },
  })
  async createPost(
    @Body() body: CreatePostDto,
    @Headers('authorization') authorization?: string,
  ): Promise<CreatePostResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.postsService.createPost(userId!, body);
  }

  @Get('me/:postId')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 게시글 상세 조회' })
  @ApiOkResponse({
    description: '작성자 본인 기준 게시글 상세 정보',
    schema: {
      example: {
        postId: 12,
        author: {
          userId: 1,
          nickname: '앨리스',
        },
        content: '봄 데일리 코디입니다.',
        status: 'ACTIVE',
        createdAt: '2026-03-20T02:00:00.000Z',
        images: [
          {
            id: 101,
            originalImageUrl: '/uploads/posts/originals/20260325/open-post.jpg',
            processedImageUrl: '/uploads/posts/processed/20260325/open-post.jpg',
            thumbnailUrl: null,
            storageKey: 'posts/originals/20260325/open-post.jpg',
            blurMethod: 'AUTO',
            aiBlurStatus: 'DONE',
            sortOrder: 0,
            isPrimary: true,
          },
        ],
        keywords: [
          {
            id: 1,
            code: 'DAILY_LOOK',
            label: '데일리룩',
            sortOrder: 0,
          },
        ],
        outfitItems: [
          {
            id: 1,
            category: 'TOP',
            itemName: '화이트 셔츠',
            brand: 'SPAO',
          },
        ],
        evaluation: {
          id: 5,
          status: 'OPEN',
          endsAt: '2026-03-26T12:00:00.000Z',
        },
        myVoteId: null,
        myVoteChoice: null,
        myFeedbackTagIds: [],
        voteSummary: {
          likeCount: 3,
          dislikeCount: 1,
          totalCount: 4,
          likeRate: 0.75,
        },
        feedbackSummary: [
          {
            tagId: 4,
            code: 'NEG_COLOR_BAD',
            label: '색 조합이 아쉬워요',
            count: 1,
            voteChoice: 'DISLIKE',
          },
        ],
      },
    },
  })
  async getMyPostDetail(
    @Param('postId', ParseIntPipe) postId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<GetPostDetailResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    return this.postsService.getMyPostDetail(postId, userId!);
  }
}
