import { Controller, Post, Get, Delete, Body, Param } from '@nestjs/common';
import {
  CreatePostRequest,
  CreatePostResponse,
  DeletePostResponse,
  GetPostDetailResponse,
  EvaluationStatus,
} from '@codinator/contracts';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  async create(@Body() _body: CreatePostRequest): Promise<CreatePostResponse> {
    return { postId: 1, evaluationId: 10, status: EvaluationStatus.ACTIVE };
  }

  @Delete(':id')
  async delete(@Param('id') _id: number): Promise<DeletePostResponse> {
    return { success: true };
  }

  @Get(':id')
  async detail(@Param('id') _id: number): Promise<GetPostDetailResponse> {
    return this.postsService.getPostDetail(_id);
  }
}

