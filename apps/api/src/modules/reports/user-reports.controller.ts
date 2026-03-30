import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { CreateReportResponse } from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('users')
export class UserReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  // ─── POST /users/:userId/reports ──────────────────────────────────────────────

  @Post(':userId/reports')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: '유저 신고' })
  @ApiParam({ name: 'userId', type: Number, example: 7, description: '신고할 유저 ID' })
  @ApiBody({ type: CreateReportDto })
  @ApiCreatedResponse({
    description: '신고 접수 완료 (PENDING)',
    schema: {
      example: { reportId: 5, status: 'PENDING' },
    },
  })
  @ApiConflictResponse({
    description: '이미 해당 유저에 대한 PENDING 신고가 있습니다.',
  })
  @ApiForbiddenResponse({
    description: '본인을 신고할 수 없습니다.',
  })
  @ApiNotFoundResponse({
    description: '사용자를 찾을 수 없습니다.',
  })
  async reportUser(
    @Param('userId', ParseIntPipe) reportedUserId: number,
    @Body() body: CreateReportDto,
    @Headers('authorization') authorization?: string,
  ): Promise<CreateReportResponse> {
    const reporterId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.reportsService.reportUser(reporterId!, reportedUserId, body);
  }
}
