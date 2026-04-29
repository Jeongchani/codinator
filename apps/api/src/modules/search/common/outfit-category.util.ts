import { BadRequestException } from '@nestjs/common';

/**
 * 게시글 도메인 outfit category 정규화 유틸.
 *
 * 텍스트 검색(SearchService.resolveTextSearchFilters)과
 * AI 이미지 검색(SearchService.resolveImageSearchFilters) 양쪽에서 공통 사용.
 *
 * ─ 수용하는 입력 형식 ─────────────────────────────────────────────────────────
 *   ① GarmentCategory enum 문자열: TOP / BOTTOM / OUTER / SHOES / BAG / ACCESSORY / ETC
 *   ② 한국어 UI 값: 상의 / 하의 / 아우터 / 신발 / 가방 / 악세사리(악세서리) / 기타
 *   (대소문자 무관, 앞뒤 공백 제거)
 *
 * ─ 명시적으로 거부하는 값 ──────────────────────────────────────────────────────
 *   DRESS / 원피스
 *   → GarmentCategory 에 존재하지 않는 카테고리.
 *   → 이전 구현에서 ETC 로 silently 매핑했으나, 잘못된 카테고리를 검색 조건에
 *     그대로 사용하면 사용자 의도와 다른 결과를 반환할 수 있다.
 *   → 400 BadRequestException 으로 명확한 에러 메시지를 반환한다.
 *
 * ─ 반환 ─────────────────────────────────────────────────────────────────────
 *   정규화된 GarmentCategory 문자열 배열 (중복 제거).
 *   빈 배열 입력 → 빈 배열 반환 (필터 없음).
 *
 * ─ 예외 ─────────────────────────────────────────────────────────────────────
 *   지원하지 않는 값(DRESS, 원피스, 기타 알 수 없는 문자열) → BadRequestException.
 */

/** 한국어 UI 값 → GarmentCategory 매핑 (DRESS/원피스 제외) */
const KOREAN_TO_GARMENT_CATEGORY: Readonly<Record<string, string>> = {
  '상의': 'TOP',
  '하의': 'BOTTOM',
  '아우터': 'OUTER',
  '신발': 'SHOES',
  '가방': 'BAG',
  '악세사리': 'ACCESSORY',
  '악세서리': 'ACCESSORY', // 표기 변형 허용
  '기타': 'ETC',
} as const;

/** 유효한 GarmentCategory enum 값 집합 (DRESS 없음 — 게시글 도메인 전용) */
const VALID_GARMENT_CATEGORIES = new Set<string>([
  'TOP',
  'BOTTOM',
  'OUTER',
  'SHOES',
  'BAG',
  'ACCESSORY',
  'ETC',
]);

/**
 * DRESS/원피스 입력 감지용 집합.
 * 이 값들은 AiGarmentCategory 에는 존재하지만 GarmentCategory(게시글 도메인)에는 없다.
 * 이전 구현처럼 ETC 로 매핑하지 않고 명확한 에러를 반환한다.
 */
const UNSUPPORTED_DRESS_VALUES = new Set<string>(['DRESS', '원피스']);

/**
 * outfitCategories 배열을 검색에 사용 가능한 GarmentCategory 문자열 배열로 정규화한다.
 *
 * @param values - 정규화할 원본 카테고리 배열 (한국어 UI 값 또는 enum 문자열)
 * @returns 정규화된 GarmentCategory 배열 (중복 제거, 순서 유지)
 * @throws BadRequestException - 지원하지 않는 카테고리 값이 포함된 경우
 */
export function normalizeSearchOutfitCategories(values: string[]): string[] {
  if (!values.length) return [];

  const result: string[] = [];

  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // 한국어 UI 값 우선 확인
    const fromKorean = KOREAN_TO_GARMENT_CATEGORY[trimmed];
    if (fromKorean) {
      result.push(fromKorean);
      continue;
    }

    const upper = trimmed.toUpperCase();

    // DRESS / 원피스 — 명시적 거부
    if (UNSUPPORTED_DRESS_VALUES.has(upper) || UNSUPPORTED_DRESS_VALUES.has(trimmed)) {
      throw new BadRequestException(
        `지원하지 않는 outfit category 값입니다: "${trimmed}". ` +
          `허용 값: TOP, BOTTOM, OUTER, SHOES, BAG, ACCESSORY, ETC (또는 한국어: 상의, 하의, 아우터, 신발, 가방, 악세사리, 기타)`,
      );
    }

    // 유효한 GarmentCategory enum
    if (VALID_GARMENT_CATEGORIES.has(upper)) {
      result.push(upper);
      continue;
    }

    // 알 수 없는 값
    throw new BadRequestException(
      `지원하지 않는 outfit category 값입니다: "${trimmed}". ` +
        `허용 값: TOP, BOTTOM, OUTER, SHOES, BAG, ACCESSORY, ETC (또는 한국어: 상의, 하의, 아우터, 신발, 가방, 악세사리, 기타)`,
    );
  }

  // 중복 제거 (순서 유지)
  return [...new Set(result)];
}
