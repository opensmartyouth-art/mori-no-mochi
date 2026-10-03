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
import type { Rect } from '../engine/canvas'

const TAU = Math.PI * 2

/**
 * 바닥 디테일(얼룩 + 풀포기)을 한 번만 만들어 두고 패턴으로 반복한다.
 * 카메라와 함께 흐르게 해야 바닥처럼 보인다.
 *
 * 이음매가 보이지 않도록 모든 요소를 3x3 으로 감아서 그린다.
 *
 * 그루터기 스프라이트와 같은 이유로 기기 픽셀에 맞춰 굽는다.
 * 디자인 해상도로 구우면 고DPI 기기에서 풀 가닥이 뭉개진다.
 */
/**
 * 구운 타일은 스케일별로 들고 있는다. 공유 이미지는 스테이지와 다른 스케일로
 * 그리는데, 슬롯이 하나뿐이면 공유를 누를 때마다 타일을 두 번 다시 굽는다.
 * (한 번은 공유용으로, 돌아와서 한 번은 화면용으로)
 */
const tiles = new Map<number, HTMLCanvasElement>()
let bound: { ctx: CanvasRenderingContext2D; scale: number; pattern: CanvasPattern } | null = null

function buildTile(scale: number): HTMLCanvasElement {
  const size = GROUND_TILE
  const cached = tiles.get(scale)
  if (cached) return cached
  const off = document.createElement('canvas')
  off.width = Math.ceil(size * scale)
  off.height = Math.ceil(size * scale)
  const g = off.getContext('2d')!
  g.scale(scale, scale)
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

  // 풀포기. 원작은 서너 가닥이 부채처럼 벌어진 또렷한 V 자다.
  // 이전엔 너무 흐려서 안 보였다.
  g.strokeStyle = COL_GRASS
  g.lineCap = 'round'
  // 화면 하나에 열 포기 남짓만 보이게. GDD 가 말하는 "드문드문" 이 이 밀도다.
  for (let i = 0; i < 16; i++) {
    const x = rng.next() * size
    const y = rng.next() * size
    const blades = Math.floor(rng.range(3, 6))
    const scale = rng.range(0.75, 1.2)
    const alpha = rng.range(0.45, 0.75)
    const seeds = Array.from({ length: blades }, () => ({
      lean: rng.range(-1, 1),
      h: rng.range(4.5, 8),
      w: rng.range(0.9, 1.5),
      dx: rng.range(-2.5, 2.5),
    }))
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        g.globalAlpha = alpha
        for (const b of seeds) {
          const bx = x + ox * size + b.dx * scale
          const by = y + oy * size
          const h = b.h * scale
          const lean = b.lean * h * 0.42
          g.lineWidth = b.w
          g.beginPath()
          g.moveTo(bx, by)
          g.quadraticCurveTo(bx + lean * 0.35, by - h * 0.62, bx + lean, by - h)
          g.stroke()
        }
      }
    }
  }
  g.globalAlpha = 1

  tiles.set(scale, off)
  return off
}

function patternFor(
  ctx: CanvasRenderingContext2D,
  scale: number,
): CanvasPattern {
  if (bound && bound.ctx === ctx && bound.scale === scale) return bound.pattern
  const pat = ctx.createPattern(buildTile(scale), 'repeat')!
  // 패턴은 캔버스의 실제 픽셀 크기로 깔리므로 디자인 단위로 되돌린다.
  pat.setTransform?.(new DOMMatrix([1 / scale, 0, 0, 1 / scale, 0, 0]))
  bound = { ctx, scale, pattern: pat }
  return pat
}

/** 카메라 평행이동만큼 흘려서 그린다. rect 는 레터박스까지 포함한 범위. */
export function drawGround(
  ctx: CanvasRenderingContext2D,
  panX: number,
  panY: number,
  rect: Rect,
  scale = 1,
): void {
  const q = Math.max(0.5, Math.round(scale * 2) / 2)
  const pattern = patternFor(ctx, q)
  ctx.save()
  const ox = ((panX % GROUND_TILE) + GROUND_TILE) % GROUND_TILE
  const oy = ((panY % GROUND_TILE) + GROUND_TILE) % GROUND_TILE
  ctx.translate(ox, oy)
  ctx.fillStyle = pattern
  ctx.fillRect(rect.x - ox, rect.y - oy, rect.w, rect.h)
  ctx.restore()
}

let vignette: CanvasGradient | null = null

/** 가장자리를 아주 살짝 눌러 시선을 가운데로 모은다. 화면 기준이라 한 번만 만든다. */
export function drawVignette(ctx: CanvasRenderingContext2D, rect: Rect): void {
  if (!vignette) vignette = makeVignette(ctx)
  ctx.fillStyle = vignette
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
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
