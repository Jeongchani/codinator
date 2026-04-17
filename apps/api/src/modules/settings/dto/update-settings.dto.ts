import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ThemeMode } from '@prisma/client';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    enum: ThemeMode,
    enumName: 'ThemeMode',
    example: 'DARK',
    description: '앱 테마 (LIGHT | DARK)',
  })
  @IsOptional()
  @IsEnum(ThemeMode)
  theme?: ThemeMode;

  @ApiPropertyOptional({ example: true, description: '전체 푸시 알림 허용 여부' })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional({ example: true, description: '서비스 푸시 알림 허용 여부' })
  @IsOptional()
  @IsBoolean()
  servicePushEnabled?: boolean;

  @ApiPropertyOptional({ example: false, description: '마케팅 푸시 알림 허용 여부' })
  @IsOptional()
  @IsBoolean()
  marketingPushEnabled?: boolean;
}
