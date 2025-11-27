// ==========================================
// 레이아웃 설정 상수 (여기서 간격 조절 가능)
// ==========================================
// 이 파일의 값을 수정하면 미리보기와 실제 다운로드 이미지 모두에 적용됩니다.

// Canvas dimensions (4x6 inch @ 300 DPI)
export const CANVAS_WIDTH = 1200
export const CANVAS_HEIGHT = 1800
export const DEFAULT_PHOTO_RATIO = 85

// Landscape canvas dimensions (6x4 inch @ 300 DPI)
export const LANDSCAPE_WIDTH = 1800
export const LANDSCAPE_HEIGHT = 1200

// TwoByTwo, VerticalTwo, HorizontalTwo, OnePlusTwo 레이아웃 설정
export const LAYOUT_CONFIG = {
  // 좌우 여백 (기본: 40px)
  MARGIN_HORIZONTAL: 20,

  // 상하 여백 (기본: 60px)
  MARGIN_VERTICAL: 20,

  // 사진 간 간격 (기본: 20px)
  // 이 값을 줄이면 사진들이 더 붙어보입니다
  // 예: 10px로 줄이면 사진 간격이 절반으로
  GAP: 20,
}

// FourCut 레이아웃 설정 (네컷은 간격이 더 좁음)
export const FOUR_CUT_CONFIG = {
  // 외곽 여백 (기본: 20px)
  MARGIN_OUTER: 13,

  // 두 스트립 사이 간격 (기본: 10px)
  GAP_CENTER: 26,

  // 사진들 사이 세로 간격 (기본: 10px)
  // 이 값을 줄이면 네컷 사진들이 더 붙어보입니다
  GAP_BETWEEN_PHOTOS:13,
}
