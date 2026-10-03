import {
  COL_BG,
  COL_MOCHI,
  COL_STUMP_SIDE,
  COL_STUMP_TOP,
  DESIGN_H,
  DESIGN_W,
  TILE,
} from '../config'
import { isoEllipse, project } from '../game/iso'
import type { Stump } from '../game/types'

const TAU = Math.PI * 2

/** 그림자를 드리우는 방향(높이 1 unit 당 화면 px). 빛은 좌상단에서 온다. */
const SHADOW_DIR_X = 1.15
const SHADOW_DIR_Y = 0.42

export function clearWorld(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COL_BG
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H)
}

/** 부드러운 타원 블롭 그림자. 하드 섀도우 금지(GDD §10). */
export function drawBlobShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  alpha: number,
): void {
  if (rx <= 0 || ry <= 0) return
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(rx, ry)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  g.addColorStop(0, `rgba(30, 36, 20, ${alpha})`)
  g.addColorStop(0.68, `rgba(30, 36, 20, ${alpha * 0.9})`)
  g.addColorStop(1, 'rgba(30, 36, 20, 0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, TAU)
  ctx.fill()
  ctx.restore()
}

export function drawStumpShadow(
  ctx: CanvasRenderingContext2D,
  s: Stump,
): void {
  const base = project(s.wx, s.wy, 0)
  const e = isoEllipse(s.r)
  drawBlobShadow(
    ctx,
    base.x + s.h * TILE * SHADOW_DIR_X,
    base.y + s.h * TILE * SHADOW_DIR_Y,
    e.x * 1.1,
    e.y * 1.14,
    0.3,
  )
}

/**
 * 원기둥. 바닥 타원 → 옆면 사각 → 윗면 타원 순으로 덮어 그리면
 * 경계 계산 없이 깨끗한 실루엣이 나온다.
 */
export function drawStump(ctx: CanvasRenderingContext2D, s: Stump): void {
  const e = isoEllipse(s.r)
  const top = project(s.wx, s.wy, s.h)
  const botY = top.y + s.h * TILE

  ctx.fillStyle = COL_STUMP_SIDE
  ctx.beginPath()
  ctx.ellipse(top.x, botY, e.x, e.y, 0, 0, TAU)
  ctx.fill()
  ctx.fillRect(top.x - e.x, top.y, e.x * 2, botY - top.y)

  ctx.fillStyle = COL_STUMP_TOP
  ctx.beginPath()
  ctx.ellipse(top.x, top.y, e.x, e.y, 0, 0, TAU)
  ctx.fill()
}

export interface MochiView {
  /** 화면 좌표(카메라 변환 전 월드 투영 좌표). */
  x: number
  y: number
  /** 가로/세로 반축(px). 스쿼시·스트레치가 반영된 값. */
  rx: number
  ry: number
}

export function drawMochi(ctx: CanvasRenderingContext2D, m: MochiView): void {
  ctx.fillStyle = COL_MOCHI
  ctx.beginPath()
  ctx.ellipse(m.x, m.y - m.ry, m.rx, m.ry, 0, 0, TAU)
  ctx.fill()
}
