import { ApiProperty } from '@nestjs/swagger';
import type { PhoneVerificationPurpose } from '@codinator/contracts';

export class VerifyPhoneCodeDto {
  @ApiProperty({
    example: '01012345678',
    description: '전화번호 (숫자만 또는 하이픈 포함)',
  })
  phoneNumber: string;

  @ApiProperty({
    example: 'SIGN_UP',
    enum: ['SIGN_UP', 'PHONE_CHANGE', 'PASSWORD_RESET'],
    description: '인증 목적',
  })
  purpose: PhoneVerificationPurpose;

  @ApiProperty({
    example: '123456',
    description: '6자리 인증 코드',
  })
  code: string;
}
