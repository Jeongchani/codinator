import { BadRequestException } from '@nestjs/common';

/**
 * 전화번호 정규화 헬퍼
 * - 숫자가 아닌 문자 제거
 * - 길이 검증: 9 ~ 15자리
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  const normalized = (phoneNumber ?? '').replace(/[^0-9]/g, '');

  if (!normalized) {
    throw new BadRequestException('전화번호는 필수값입니다.');
  }

  if (normalized.length < 9 || normalized.length > 15) {
    throw new BadRequestException('전화번호 형식이 올바르지 않습니다.');
  }

  return normalized;
}
