/**
 * 튜닝 상수 단일 소스.
 * 숫자를 바꾸고 싶으면 이 파일만 본다. 다른 파일에 리터럴을 두지 않는다.
 *
 * 월드 단위(unit)는 평면 거리의 기준이다. 그루터기 기본 반지름이 1.0 unit,
 * TILE 이 1 unit 을 몇 픽셀로 투영할지 정한다.
 */

// ── 화면 ──────────────────────────────────────────────────────────
/** 디자인 공간. 원작 영상 588x1278(1:2.173)에 맞춘 세로 고정 비율. */
export const DESIGN_W = 390
export const DESIGN_H = 844

// ── 루프 ──────────────────────────────────────────────────────────
/** 물리 스텝. 60Hz 고정. */
export const FIXED_DT = 1 / 60
/** 탭 전환 등으로 프레임이 튀었을 때 따라잡기 상한(초). */
export const MAX_FRAME_DT = 0.25

// ── 아이소메트릭 투영 ─────────────────────────────────────────────
/** 월드 1 unit → 픽셀. */
export const TILE = 50
/** 2:1 아이소. */
export const ISO_X = 0.5
export const ISO_Y = 0.25

// ── 그루터기 ──────────────────────────────────────────────────────
/** 반지름 3종(월드 unit). */
export const STUMP_RADII = [1.0, 0.86, 0.72]
/** 높이 2종(월드 unit). 낮은 것·높은 것. */
export const STUMP_HEIGHTS = [0.45, 0.78]

// ── 거리 / 난이도 커브 ────────────────────────────────────────────
/**
 * 차지 0 → 최소 거리, 차지 1 → 최대 거리.
 *
 * 그루터기는 앞으로 LOOKAHEAD 개까지 미리 **직전 그루터기 중심 기준**으로 놓인다.
 * 모찌는 중심에서 최대 그루터기 반지름만큼 벗어나 서 있을 수 있으므로,
 * 실제로 필요한 거리는 생성 거리 ± 반지름까지 벌어진다.
 * 차지 범위는 그 최악을 덮어야 도달 불가가 생기지 않는다.
 *   생성 [2.3, 4.3] ± 1.0  →  [1.3, 5.3] ⊂ [MIN_DIST, MAX_DIST]
 */
export const MIN_DIST = 1.3
export const MAX_DIST = 5.3
/** 생성 거리 범위. 초반 EASY_COUNT 개는 START 쪽만 쓴다. */
export const GEN_MIN_DIST = 2.3
export const GEN_MAX_DIST = 4.3
export const START_MIN_DIST = 2.3
export const START_MAX_DIST = 3.2
/** 앞쪽으로 미리 만들어 두는 그루터기 수. 원작처럼 길이 보여야 한다. */
export const LOOKAHEAD = 4
/** 이 개수까지는 난이도 고정, 이후 RAMP_COUNT 까지 선형으로 올린다. */
export const EASY_COUNT = 10
export const RAMP_COUNT = 45
/** 난이도 0 → 1 에 따라 작은 반지름이 뽑힐 확률. */
export const SMALL_RADIUS_CHANCE = 0.75
/** 화면 아래로 이만큼(px) 넘어간 그루터기는 배열에서 버린다. */
export const CULL_MARGIN = 140
/** 어떤 경우에도 뒤쪽 그루터기를 이 개수보다 적게 남기지 않는다. */
export const KEEP_BEHIND = 2

// ── 모찌 ──────────────────────────────────────────────────────────
/** 기본 반축(px). 살짝 세로로 긴 달걀꼴. */
export const MOCHI_RX = 13
export const MOCHI_RY = 15

// ── 차지 ──────────────────────────────────────────────────────────
/**
 * 0 → 최대 차지까지 걸리는 시간(초). 영상 실측으로 중간 세기 차지가 약 0.7s 였다.
 * 차지 범위가 4.0 unit 이므로 약 4.2 unit/s. 가장 큰 그루터기의 퍼펙트 창이 약 150ms.
 */
export const CHARGE_TIME = 0.95
/** 최대 차지 시 모찌 높이가 줄어드는 비율. 스쿼시가 곧 게이지다. */
export const SQUASH_MAX = 0.46
/** 차지 상한 도달 알림용 떨림. */
export const CHARGE_WOBBLE_AMP = 0.022
export const CHARGE_WOBBLE_HZ = 14

// ── 점프 물리 ─────────────────────────────────────────────────────
/** 중력(unit/s²). 체공시간과 함께 포물선 높이를 결정한다. */
export const GRAVITY = 46
/** 체공시간 = BASE_AIR + dist * AIR_PER_DIST (초). 영상 실측 약 0.4s. */
export const BASE_AIR = 0.3
export const AIR_PER_DIST = 0.052
/** 비행 중 세로 스트레치. |vz| 비례분 + 상시분. */
export const FLIGHT_STRETCH = 0.26
export const FLIGHT_STRETCH_BASE = 0.1

// ── 착지 판정 ─────────────────────────────────────────────────────
/** PERFECT_R = 그루터기 반지름 × 이 비율. GDD 기준 25~30%. */
export const PERFECT_R_RATIO = 0.3
/** 착지 순간 눌리는 양과 회복 시간(초). */
export const LAND_SQUASH = 0.34
export const LAND_RECOVER = 0.26

// ── 실패(낙하) ────────────────────────────────────────────────────
/** 모서리에서 미끄러지는 거리(unit)와 결과 카드까지의 시간(초). */
export const FALL_SLIDE = 0.9
export const FALL_TIME = 1.05
export const FALL_GRAVITY = 30

// ── 스코어 ────────────────────────────────────────────────────────
/** 그루터기 1개 = 10점. */
export const STUMP_SCORE = 10
/** 퍼펙트 점수 = PERFECT_BASE × 현재 연속 횟수. */
export const PERFECT_BASE = 10
/**
 * 연속 배수의 상한. 원작 결과 카드(최고 3연속)로는 상한을 확정할 수 없다.
 * 타이틀 기록에 "퍼펙트 11연속"이 있으니 최소 11까지는 올라간다.
 * 확정 전까지 무제한. GDD §14 열린 질문.
 */
export const PERFECT_MULT_CAP = Number.POSITIVE_INFINITY

// ── 카메라 ────────────────────────────────────────────────────────
/** 착지 후 추종 보간. 점프 중에는 거의 고정. */
export const CAM_LERP = 0.08
export const CAM_LERP_AIR = 0.012
/** 모찌를 둘 화면상 위치(0~1). 중앙보다 약간 왼쪽·아래. */
export const CAM_ANCHOR_X = 0.45
export const CAM_ANCHOR_Y = 0.6

// ── 연출 타이밍 ───────────────────────────────────────────────────
export const RING_TIME = 0.55
export const RING_MAX_SCALE = 1.9
export const LABEL_TIME = 0.9
/** 착지 먼지. 그루터기 윗면에서 바깥으로 퍼진다. */
export const DUST_COUNT = 7
export const DUST_TIME = 0.5
export const DUST_SPREAD = 0.55
/** 화면 흔들림. 과하면 싸구려가 된다 — px 단위로 한 자리수만. */
export const SHAKE_TIME = 0.22
export const SHAKE_OK = 1.5
export const SHAKE_PERFECT = 2.6
export const SHAKE_MISS = 3.6

// ── 색 ────────────────────────────────────────────────────────────
// 원작의 강점은 절제다. 색 수를 늘리지 말고 한 계열 안에서 명도만 움직인다.
export const COL_BG = '#6f7a54'
/** 바닥 얼룩. 배경과의 대비를 아주 낮게 유지한다. */
export const COL_BG_DARK = '#67724c'
export const COL_BG_LIGHT = '#78835d'
export const COL_GRASS = '#828d61'

export const COL_STUMP_TOP = '#d7c399'
/** 윗면 가운데 하이라이트. 빛은 좌상단에서 온다. */
export const COL_STUMP_TOP_LIT = '#e4d3ae'
export const COL_STUMP_RING = 'rgba(146, 112, 73, 0.26)'
export const COL_STUMP_RIM = 'rgba(112, 84, 55, 0.4)'
export const COL_STUMP_SIDE = '#5d4330'
export const COL_STUMP_SIDE_LIT = '#6d5039'
export const COL_STUMP_SIDE_DARK = '#473225'

export const COL_MOCHI = '#fcfbf7'
export const COL_MOCHI_SHADE = '#e4dfd1'
export const COL_EYE = '#3a3f2c'

export const COL_INK = '#2f3524'
export const COL_TEXT = '#ffffff'
export const COL_GOLD = '#e8c07a'

/** 바닥 디테일 타일 한 변(px). 반복이 눈에 띄지 않게 대비를 낮게 둔다. */
export const GROUND_TILE = 512
/** 화면 가장자리 비네트 세기. */
export const VIGNETTE = 0.16

export const FONT_STACK =
  '-apple-system, "SF Pro Rounded", "Apple SD Gothic Neo", "Pretendard", system-ui, sans-serif'
