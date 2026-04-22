import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ExchangeKakaoCodeRequest } from '@codinator/contracts';

export class ExchangeKakaoCodeDto implements ExchangeKakaoCodeRequest {
  @ApiProperty({
    example: 'XYZ_kakao_authorization_code',
    description: 'Kakao 인가코드 (프론트 redirect_uri 로 전달받은 code 파라미터)',
  })
  code: string;

  @ApiProperty({
    example: 'https://yourapp.com/auth/kakao/callback',
    description: 'Kakao 앱 설정의 redirect_uri 와 정확히 일치해야 함',
  })
  redirectUri: string;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description:
      '로그인 상태 유지 여부. ' +
      'complete-profile 단계로 전달되는 값이며, 이 단계에서는 세션을 생성하지 않음.',
  })
  rememberMe?: boolean;
}
