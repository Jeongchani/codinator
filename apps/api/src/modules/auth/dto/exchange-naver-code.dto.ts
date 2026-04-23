import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ExchangeNaverCodeRequest } from '@codinator/contracts';

export class ExchangeNaverCodeDto implements ExchangeNaverCodeRequest {
  @ApiProperty({
    example: 'XYZ_naver_authorization_code',
    description: 'Naver 인가코드 (프론트 redirect_uri 로 전달받은 code 파라미터)',
  })
  code: string;

  @ApiProperty({
    example: 'random_state_string',
    description: 'CSRF 방지용 state 값 (Naver 인가코드 요청 시 사용한 state 와 동일)',
  })
  state: string;

  @ApiProperty({
    example: 'https://yourapp.com/auth/naver/callback',
    description: 'Naver 앱 설정의 redirect_uri',
  })
  redirectUri: string;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description: '로그인 상태 유지 여부. complete-profile 단계로 전달되는 값.',
  })
  rememberMe?: boolean;
}
