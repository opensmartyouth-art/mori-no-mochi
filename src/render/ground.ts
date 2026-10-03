import {
  COL_BG,
  COL_BG_DARK,
  COL_BG_LIGHT,
  COL_GRASS,
  DESIGN_H,
  DESIGN_W,
  GROUND_TILE,
  VIGNETTE,
} from '../config'
import { createRng } from '../engine/rng'

const TAU = Math.PI * 2

/**
 * 바닥 디테일(얼룩 + 풀포기)을 한 번만 만들어 두고 패턴으로 반복한다.
 * 카메라와 함께 흐르게 해야 바닥처럼 보인다.
 *
 * 이음매가 보이지 않도록 모든 요소를 3x3 으로 감아서 그린다.
 */
let pattern: CanvasPattern | null = null

function buildTile(ctx: CanvasRenderingContext2D): CanvasPattern {
  const size = GROUND_TILE
  const off = document.createElement('canvas')
  off.width = size
  off.height = size
  const g = off.getContext('2d')!
  g.fillStyle = COL_BG
  g.fillRect(0, 0, size, size)

  const rng = createRng(0x6f7a54)

  // 큰 얼룩 — 초점 나간 수풀 그림자처럼
  for (let i = 0; i < 26; i++) {
    const x = rng.next() * size
    const y = rng.next() * size
    const r = rng.range(50, 150)
    const light = rng.chance(0.45)
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const grad = g.createRadialGradient(
          x + ox * size,
          y + oy * size,
          0,
          x + ox * size,
          y + oy * size,
          r,
        )
        grad.addColorStop(0, light ? COL_BG_LIGHT : COL_BG_DARK)
        grad.addColorStop(1, 'rgba(111, 122, 84, 0)')
        g.globalAlpha = rng.range(0.3, 0.55)
        g.fillStyle = grad
        g.beginPath()
        g.arc(x + ox * size, y + oy * size, r, 0, TAU)
        g.fill()
      }
    }
  }
  g.globalAlpha = 1

  // 드문드문 풀포기. 몇 픽셀짜리 짧은 획이면 충분하다.
  g.strokeStyle = COL_GRASS
  g.lineCap = 'round'
  for (let i = 0; i < 150; i++) {
    const x = rng.next() * size
    const y = rng.next() * size
    const blades = Math.floor(rng.range(2, 4))
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        g.globalAlpha = rng.range(0.25, 0.5)
        for (let b = 0; b < blades; b++) {
          const bx = x + ox * size + rng.range(-3, 3)
          const by = y + oy * size + rng.range(-2, 2)
          const h = rng.range(2.5, 5)
          const lean = rng.range(-1.6, 1.6)
          g.lineWidth = rng.range(0.7, 1.2)
          g.beginPath()
          g.moveTo(bx, by)
          g.quadraticCurveTo(bx + lean * 0.5, by - h * 0.6, bx + lean, by - h)
          g.stroke()
        }
      }
    }
  }
  g.globalAlpha = 1

  return ctx.createPattern(off, 'repeat')!
}

/** 카메라 평행이동만큼 흘려서 그린다. */
export function drawGround(
  ctx: CanvasRenderingContext2D,
  panX: number,
  panY: number,
): void {
  if (!pattern) pattern = buildTile(ctx)
  ctx.save()
  const ox = ((panX % GROUND_TILE) + GROUND_TILE) % GROUND_TILE
  const oy = ((panY % GROUND_TILE) + GROUND_TILE) % GROUND_TILE
  ctx.translate(ox, oy)
  ctx.fillStyle = pattern
  ctx.fillRect(-ox, -oy, DESIGN_W, DESIGN_H)
  ctx.restore()
}

let vignette: CanvasGradient | null = null

/** 가장자리를 아주 살짝 눌러 시선을 가운데로 모은다. 화면 기준이라 한 번만 만든다. */
export function drawVignette(ctx: CanvasRenderingContext2D): void {
  if (!vignette) vignette = makeVignette(ctx)
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H)
}

function makeVignette(ctx: CanvasRenderingContext2D): CanvasGradient {
  const g = ctx.createRadialGradient(
    DESIGN_W / 2,
    DESIGN_H * 0.46,
    DESIGN_H * 0.26,
    DESIGN_W / 2,
    DESIGN_H * 0.46,
    DESIGN_H * 0.72,
  )
  g.addColorStop(0, 'rgba(32, 38, 22, 0)')
  g.addColorStop(1, `rgba(32, 38, 22, ${VIGNETTE})`)
  return g
}
