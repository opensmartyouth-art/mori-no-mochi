import { TILE } from '../config'
import { isoEllipse } from '../game/iso'
import { paintStump } from './scene'

/**
 * 그루터기와 그림자를 비트맵으로 미리 구워 둔다.
 *
 * 매 프레임 그루터기마다 그라디언트를 만들고 결을 긋는 방식은 60fps 가 안 나왔다.
 * 종류가 반지름 3 × 높이 2 × 결 변주 4 로 적으니 전부 캐시해도 몇 MB 안 된다.
 * 기기 픽셀에 1:1 로 맞춰 구워야 흐려지지 않으므로 스케일이 바뀌면 전부 버린다.
 */
export interface Sprite {
  canvas: HTMLCanvasElement
  /** 스프라이트 안에서 기준점(그루터기는 윗면 중심)의 위치. 디자인 px. */
  ox: number
  oy: number
  /** 디자인 px 단위의 크기. */
  w: number
  h: number
}

export const STUMP_VARIANTS = 4

let scale = 1
const stumps = new Map<string, Sprite>()
let shadow: HTMLCanvasElement | null = null

/** 디자인 1px 이 기기 몇 px 인지. 바뀌면 캐시를 버린다. */
export function setSpriteScale(s: number): void {
  const q = Math.max(0.5, Math.round(s * 4) / 4)
  if (q === scale) return
  scale = q
  stumps.clear()
}

function make(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w * scale))
  c.height = Math.max(1, Math.ceil(h * scale))
  const ctx = c.getContext('2d')!
  ctx.scale(scale, scale)
  return [c, ctx]
}

export function stumpSprite(r: number, h: number, variant: number): Sprite {
  const key = `${r}|${h}|${variant}`
  const hit = stumps.get(key)
  if (hit) return hit

  const e = isoEllipse(r)
  const pad = 2
  const w = e.x * 2 + pad * 2
  const height = e.y + h * TILE + e.y + pad * 2
  const ox = e.x + pad
  const oy = e.y + pad

  const [canvas, ctx] = make(w, height)
  ctx.translate(ox, oy)
  paintStump(ctx, r, h, variant)

  const sprite: Sprite = { canvas, ox, oy, w, h: height }
  stumps.set(key, sprite)
  return sprite
}

/** 부드러운 블롭 하나를 구워 두고 늘려 쓴다. 그림자는 전부 같은 모양이다. */
function shadowBlob(): HTMLCanvasElement {
  if (shadow) return shadow
  const size = 128
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(30, 36, 20, 1)')
  grad.addColorStop(0.62, 'rgba(30, 36, 20, 0.86)')
  grad.addColorStop(1, 'rgba(30, 36, 20, 0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  shadow = c
  return c
}

export function blitShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  alpha: number,
): void {
  if (rx <= 0 || ry <= 0) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.drawImage(shadowBlob(), cx - rx, cy - ry, rx * 2, ry * 2)
  ctx.restore()
}

export function blitStump(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  x: number,
  y: number,
): void {
  ctx.drawImage(s.canvas, x - s.ox, y - s.oy, s.w, s.h)
}
