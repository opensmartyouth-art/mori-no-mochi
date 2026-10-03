import { CAM_ANCHOR_X, CAM_ANCHOR_Y, DESIGN_H, DESIGN_W } from '../config'
import { project } from './iso'
import type { Stump } from './types'
import { follow, mix } from '../engine/ease'

/** 화면에 적용할 평행이동(px). 줌은 없다(GDD §9). */
export interface Camera {
  px: number
  py: number
}

const ANCHOR_X = DESIGN_W * CAM_ANCHOR_X
const ANCHOR_Y = DESIGN_H * CAM_ANCHOR_Y

/** 이 그루터기 윗면이 앵커에 오도록 하는 평행이동. */
export function panFor(s: Stump): { x: number; y: number } {
  const p = project(s.wx, s.wy, s.h)
  return { x: ANCHOR_X - p.x, y: ANCHOR_Y - p.y }
}

export function createCamera(focus: Stump): Camera {
  const p = panFor(focus)
  return { px: p.x, py: p.y }
}

/** rate 는 60Hz 한 프레임 기준 비율. dt 가 달라도 같은 속도로 따라간다. */
export function updateCamera(
  cam: Camera,
  focus: Stump,
  rate: number,
  dt: number,
): void {
  const want = panFor(focus)
  const k = follow(rate, dt)
  cam.px = mix(cam.px, want.x, k)
  cam.py = mix(cam.py, want.y, k)
}
