import {
  COL_BG,
  COL_EYE,
  COL_MOCHI,
  COL_MOCHI_SHADE,
  COL_STUMP_RIM,
  COL_STUMP_RING,
  COL_STUMP_SIDE,
  COL_STUMP_SIDE_DARK,
  COL_STUMP_SIDE_LIT,
  COL_STUMP_TOP,
  COL_STUMP_TOP_LIT,
  DESIGN_H,
  DESIGN_W,
  TILE,
} from '../config'
import { isoEllipse } from '../game/iso'

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
  g.addColorStop(0.62, `rgba(30, 36, 20, ${alpha * 0.86})`)
  g.addColorStop(1, 'rgba(30, 36, 20, 0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, TAU)
  ctx.fill()
  ctx.restore()
}

/** 그루터기 그림자의 중심 오프셋(윗면 중심 기준)과 크기. */
export function stumpShadowGeom(r: number, h: number): {
  dx: number
  dy: number
  rx: number
  ry: number
} {
  const e = isoEllipse(r)
  return {
    dx: h * TILE * SHADOW_DIR_X,
    dy: h * TILE * (1 + SHADOW_DIR_Y),
    rx: e.x * 1.1,
    ry: e.y * 1.18,
  }
}

/** 원기둥 옆면의 실루엣. 윗면 앞쪽 반 → 왼쪽 수직 → 바닥 앞쪽 반 → 닫기. */
function sidePath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  botY: number,
  rx: number,
  ry: number,
): void {
  ctx.beginPath()
  ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI)
  ctx.lineTo(cx - rx, botY)
  ctx.ellipse(cx, botY, rx, ry, 0, Math.PI, 0, true)
  ctx.closePath()
}

/** 그루터기마다 결이 조금씩 달라야 복제처럼 보이지 않는다. */
const hash = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * 윗면 중심을 원점으로 두고 그루터기 하나를 그린다.
 * 매 프레임 그라디언트를 새로 만들면 60fps 가 안 나와서,
 * 이 함수는 스프라이트를 구울 때 한 번만 돈다(render/sprites.ts).
 */
export function paintStump(
  ctx: CanvasRenderingContext2D,
  r: number,
  h: number,
  variant: number,
): void {
  const e = isoEllipse(r)
  const top = { x: 0, y: 0 }
  const botY = h * TILE
  const s = { r, index: variant }

  // ── 옆면: 세로 결 ──────────────────────────────────────────────
  ctx.save()
  sidePath(ctx, top.x, top.y, botY, e.x, e.y)
  ctx.clip()

  const sideGrad = ctx.createLinearGradient(top.x - e.x, 0, top.x + e.x, 0)
  sideGrad.addColorStop(0, COL_STUMP_SIDE_LIT)
  sideGrad.addColorStop(0.42, COL_STUMP_SIDE)
  sideGrad.addColorStop(1, COL_STUMP_SIDE_DARK)
  ctx.fillStyle = sideGrad
  ctx.fillRect(top.x - e.x, top.y - e.y, e.x * 2, botY - top.y + e.y * 2)

  const grains = Math.round(7 + r * 6)
  for (let i = 0; i < grains; i++) {
    const seed = hash(s.index * 31 + i)
    const u = (i + 0.5) / grains + (seed - 0.5) * 0.05
    const x = top.x - e.x + u * e.x * 2
    ctx.globalAlpha = 0.05 + seed * 0.09
    ctx.fillStyle = seed > 0.5 ? COL_STUMP_SIDE_DARK : COL_STUMP_SIDE_LIT
    ctx.fillRect(x, top.y - e.y, 0.8 + seed * 1.6, botY - top.y + e.y * 2)
  }
  ctx.globalAlpha = 1

  // 바닥 쪽을 살짝 눌러 접지를 만든다
  const footGrad = ctx.createLinearGradient(0, botY - e.y * 2.2, 0, botY + e.y)
  footGrad.addColorStop(0, 'rgba(40, 30, 20, 0)')
  footGrad.addColorStop(1, 'rgba(40, 30, 20, 0.33)')
  ctx.fillStyle = footGrad
  ctx.fillRect(top.x - e.x, botY - e.y * 2.2, e.x * 2, e.y * 3.2)
  ctx.restore()

  // ── 윗면: 나이테 ───────────────────────────────────────────────
  const topGrad = ctx.createRadialGradient(
    top.x - e.x * 0.3,
    top.y - e.y * 0.35,
    0,
    top.x,
    top.y,
    e.x * 1.15,
  )
  topGrad.addColorStop(0, COL_STUMP_TOP_LIT)
  topGrad.addColorStop(1, COL_STUMP_TOP)
  ctx.fillStyle = topGrad
  ctx.beginPath()
  ctx.ellipse(top.x, top.y, e.x, e.y, 0, 0, TAU)
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.ellipse(top.x, top.y, e.x, e.y, 0, 0, TAU)
  ctx.clip()
  ctx.strokeStyle = COL_STUMP_RING
  const rings = 3 + Math.round(hash(s.index) * 2)
  // 나이테 중심은 살짝 치우쳐야 자연스럽다
  const ox = (hash(s.index * 7) - 0.5) * e.x * 0.3
  const oy = (hash(s.index * 13) - 0.5) * e.y * 0.3
  for (let i = 1; i <= rings; i++) {
    const k = i / (rings + 0.6)
    ctx.lineWidth = 0.7 + hash(s.index + i) * 0.7
    ctx.beginPath()
    ctx.ellipse(top.x + ox * k, top.y + oy * k, e.x * k, e.y * k, 0, 0, TAU)
    ctx.stroke()
  }
  ctx.restore()

  ctx.strokeStyle = COL_STUMP_RIM
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(top.x, top.y, e.x - 0.6, e.y - 0.6, 0, 0, TAU)
  ctx.stroke()
}

export interface MochiLook {
  /** 바닥 접지점(화면 좌표). */
  x: number
  y: number
  rx: number
  ry: number
  /** 시선 방향. -1 왼쪽 ~ +1 오른쪽. */
  look: number
}

/** 흰 타원체 + 점 두 개. 표정 변화는 없다(GDD §10). */
export function drawMochi(ctx: CanvasRenderingContext2D, m: MochiLook): void {
  const cy = m.y - m.ry
  const g = ctx.createRadialGradient(
    m.x - m.rx * 0.35,
    cy - m.ry * 0.4,
    m.rx * 0.1,
    m.x,
    cy,
    m.rx * 1.5,
  )
  g.addColorStop(0, COL_MOCHI)
  g.addColorStop(1, COL_MOCHI_SHADE)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(m.x, cy, m.rx, m.ry, 0, 0, TAU)
  ctx.fill()

  const ex = m.rx * 0.36
  const ey = cy + m.ry * 0.08
  const shift = m.look * m.rx * 0.12
  ctx.fillStyle = COL_EYE
  ctx.beginPath()
  ctx.ellipse(m.x - ex + shift, ey, m.rx * 0.11, m.ry * 0.14, 0, 0, TAU)
  ctx.ellipse(m.x + ex + shift, ey, m.rx * 0.11, m.ry * 0.14, 0, 0, TAU)
  ctx.fill()
}
