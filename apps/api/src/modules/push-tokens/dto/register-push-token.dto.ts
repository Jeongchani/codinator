import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { PushDevice } from '@prisma/client';

export class RegisterPushTokenDto {
  @ApiProperty({
    example: 'fcm-token-abc123',
    description: '디바이스 푸시 토큰 (FCM 등)',
  })
  @IsString()
  @IsNotEmpty()
  pushToken!: string;

  @ApiProperty({
    enum: PushDevice,
    enumName: 'PushDevice',
    example: 'IOS',
    description: '디바이스 OS (IOS | ANDROID | WEB)',
  })
  @IsEnum(PushDevice)
  deviceOs!: PushDevice;
}
