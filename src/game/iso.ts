import { ISO_X, ISO_Y, TILE } from '../config'

/**
 * 아이소메트릭 투영. 로직은 전부 평면(wx, wy) + 높이(wz) 로 돌고
 * 화면 좌표는 여기서만 만든다.
 *
 * GDD §4 의 식에서 screenY 부호를 뒤집었다. 원식대로면 +x, +y 둘 다
 * screenY 가 증가해 전진할수록 화면 아래로 내려가는데,
 * 원작 영상(ref/source.mp4)은 새 그루터기가 위에서 나타난다.
 * 따라서 +x = 우상향, +y = 좌상향 두 갈래가 된다.
 */
const SQRT2 = Math.SQRT2

export interface Vec2 {
  x: number
  y: number
}

export const projectX = (wx: number, wy: number): number =>
  (wx - wy) * TILE * ISO_X

export const projectY = (wx: number, wy: number, wz: number): number =>
  -(wx + wy) * TILE * ISO_Y - wz * TILE

export const project = (wx: number, wy: number, wz: number): Vec2 => ({
  x: projectX(wx, wy),
  y: projectY(wx, wy, wz),
})

/** 평면상 반지름 r 인 원 → 화면상 타원의 반축(px). 항상 2:1. */
export const isoEllipse = (r: number): Vec2 => ({
  x: r * TILE * ISO_X * SQRT2,
  y: r * TILE * ISO_Y * SQRT2,
})

/** 클수록 카메라에서 멀다. 먼 것부터 그린다. */
export const depth = (wx: number, wy: number): number => wx + wy
