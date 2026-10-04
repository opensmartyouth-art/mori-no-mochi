import {
  COL_BLUSH,
  COL_CARD_INK,
  COL_GOLD,
  COL_INK,
  COL_MOCHI,
  DESIGN_H,
  DESIGN_W,
  FONT_STACK,
} from '../config'
import { clamp01, easeOutCubic, mix } from '../engine/ease'
import { getBest } from '../game/session'
import { stumpScore, totalScore } from '../game/score'
import type { World } from '../game/world'

const CARD_W = 318
const CARD_H = 296
const CARD_X = (DESIGN_W - CARD_W) / 2
const CARD_Y = 292


const COL_MUTED = '#8e8a7c'
const COL_LINE = 'rgba(47, 53, 36, 0.1)'

const BTN_R = 25
const BTN_Y = CARD_Y + CARD_H + 52

export type ButtonId = 'share' | 'retry' | 'home'

export interface CardButton {
  id: ButtonId
  cx: number
  cy: number
  r: number
  label: string
}

const GAP = 84

export const cardButtons = (): CardButton[] => [
  { id: 'share', cx: DESIGN_W / 2 - GAP, cy: BTN_Y, r: BTN_R, label: '공유' },
  { id: 'retry', cx: DESIGN_W / 2, cy: BTN_Y, r: BTN_R + 4, label: '다시 하기' },
  { id: 'home', cx: DESIGN_W / 2 + GAP, cy: BTN_Y, r: BTN_R, label: '처음으로' },
]

export function hitButton(x: number, y: number): CardButton | null {
  for (const b of cardButtons()) {
    if (Math.hypot(x - b.cx, y - b.cy) <= b.r + 14) return b
  }
  return null
}

function row(
  ctx: CanvasRenderingContext2D,
  y: number,
  left: string,
  right: string,
  strong = false,
): void {
  ctx.textAlign = 'left'
  ctx.font = `${strong ? 700 : 500} ${strong ? 14 : 12}px ${FONT_STACK}`
  ctx.fillStyle = strong ? COL_INK : COL_MUTED
  ctx.fillText(left, CARD_X + 24, y)
  ctx.textAlign = 'right'
  ctx.font = `${strong ? 800 : 600} ${strong ? 20 : 12}px ${FONT_STACK}`
  ctx.fillStyle = COL_INK
  ctx.fillText(right, CARD_X + CARD_W - 24, y)
}

export function mochiFace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
): void {
  ctx.fillStyle = COL_MOCHI
  ctx.beginPath()
  ctx.ellipse(cx, cy, 27, 24, 0, 0, Math.PI * 2)
  ctx.fill()
  // 인게임 모찌와 같은 얼굴이어야 한다. 볼이 빠지면 다른 캐릭터로 보인다.
  ctx.fillStyle = COL_BLUSH
  ctx.beginPath()
  ctx.ellipse(cx - 14, cy + 4, 4.8, 2.8, 0, 0, Math.PI * 2)
  ctx.ellipse(cx + 14, cy + 4, 4.8, 2.8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = COL_INK
  ctx.beginPath()
  ctx.ellipse(cx - 9, cy - 2, 2.6, 3.4, 0, 0, Math.PI * 2)
  ctx.ellipse(cx + 9, cy - 2, 2.6, 3.4, 0, 0, Math.PI * 2)
  ctx.fill()
}

function icoRetry(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.beginPath()
  ctx.arc(cx, cy, 9, Math.PI * 0.35, Math.PI * 1.75)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx + 2.5, cy - 11.5)
  ctx.lineTo(cx + 7.5, cy - 7.5)
  ctx.lineTo(cx + 1.5, cy - 4)
  ctx.stroke()
}

function icoShare(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.beginPath()
  ctx.moveTo(cx, cy - 9)
  ctx.lineTo(cx, cy + 3)
  ctx.moveTo(cx - 4, cy - 5)
  ctx.lineTo(cx, cy - 9.5)
  ctx.lineTo(cx + 4, cy - 5)
  ctx.moveTo(cx - 7, cy - 1)
  ctx.lineTo(cx - 7, cy + 8)
  ctx.lineTo(cx + 7, cy + 8)
  ctx.lineTo(cx + 7, cy - 1)
  ctx.stroke()
}

function icoHome(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.beginPath()
  ctx.moveTo(cx - 8, cy - 0.5)
  ctx.lineTo(cx, cy - 8)
  ctx.lineTo(cx + 8, cy - 0.5)
  ctx.moveTo(cx - 5.5, cy - 2)
  ctx.lineTo(cx - 5.5, cy + 7.5)
  ctx.lineTo(cx + 5.5, cy + 7.5)
  ctx.lineTo(cx + 5.5, cy - 2)
  ctx.stroke()
}

export interface ResultOpts {
  /** 공유 이미지에는 버튼을 넣지 않는다. 받는 사람이 누를 수 없다. */
  buttons?: boolean
  /**
   * 배경 암전을 칠할 범위. 바닥과 비네트는 레터박스까지 칠하므로
   * 암전만 디자인 사각형에서 끊기면 양옆에 밝은 띠가 남는다.
   */
  scrim?: { x: number; y: number; w: number; h: number }
}

/**
 * 둥근 사각형. ctx.roundRect 는 Safari 16.4 / Chrome 99 미만에 없다.
 * 가드 없이 쓰면 결과 카드가 통째로 안 그려지고 매 프레임 예외가 난다.
 */
export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  const c = ctx as CanvasRenderingContext2D & {
    roundRect?: (x: number, y: number, w: number, h: number, r: number) => void
  }
  if (typeof c.roundRect === 'function') {
    c.roundRect(x, y, w, h, r)
    return
  }
  const rr = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** 결과 카드(GDD §10). t 는 'over' 가 된 뒤 흐른 시간(초). */
export function drawResult(
  ctx: CanvasRenderingContext2D,
  w: World,
  t: number,
  opts: ResultOpts = {},
): void {
  const withButtons = opts.buttons !== false
  const k = easeOutCubic(clamp01(t / 0.42))
  const best = getBest()
  const s = w.score

  const sc = opts.scrim ?? { x: 0, y: 0, w: DESIGN_W, h: DESIGN_H }

  ctx.save()
  ctx.globalAlpha = k
  ctx.fillStyle = 'rgba(28, 33, 18, 0.28)'
  ctx.fillRect(sc.x, sc.y, sc.w, sc.h)
  ctx.translate(0, mix(26, 0, k))

  // 카드보다 먼저 그려서 윗부분만 빼꼼 나오게 한다.
  mochiFace(ctx, DESIGN_W / 2, CARD_Y - 11)

  ctx.fillStyle = COL_CARD_INK
  roundRectPath(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 26)
  ctx.fill()

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'center'
  ctx.font = `600 12px ${FONT_STACK}`
  ctx.fillStyle = COL_MUTED
  ctx.fillText('그루터기', DESIGN_W / 2, CARD_Y + 50)

  ctx.font = `800 54px ${FONT_STACK}`
  ctx.fillStyle = COL_INK
  ctx.fillText(String(s.stumps), DESIGN_W / 2, CARD_Y + 104)

  ctx.font = `700 13px ${FONT_STACK}`
  ctx.fillStyle = COL_GOLD
  ctx.fillText(`최고 ${best.stumps}`, DESIGN_W / 2, CARD_Y + 126)

  ctx.strokeStyle = COL_LINE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(CARD_X + 24, CARD_Y + 148)
  ctx.lineTo(CARD_X + CARD_W - 24, CARD_Y + 148)
  ctx.stroke()

  row(ctx, CARD_Y + 176, `그루터기 ${s.stumps}개 × 10`, String(stumpScore(s)))
  row(
    ctx,
    CARD_Y + 200,
    `퍼펙트 ×${s.perfects} (최고 ${s.bestCombo}연속)`,
    `+${s.perfectScore}`,
  )

  ctx.beginPath()
  ctx.moveTo(CARD_X + 24, CARD_Y + 218)
  ctx.lineTo(CARD_X + CARD_W - 24, CARD_Y + 218)
  ctx.stroke()

  row(ctx, CARD_Y + 250, '점수', String(totalScore(s)), true)

  ctx.textAlign = 'right'
  ctx.font = `600 11px ${FONT_STACK}`
  ctx.fillStyle = COL_MUTED
  ctx.fillText(`최고 점수 ${best.score}`, CARD_X + CARD_W - 24, CARD_Y + 272)

  for (const b of withButtons ? cardButtons() : []) {
    ctx.fillStyle = COL_CARD_INK
    ctx.beginPath()
    ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = COL_INK
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (b.id === 'retry') icoRetry(ctx, b.cx, b.cy)
    else if (b.id === 'share') icoShare(ctx, b.cx, b.cy)
    else icoHome(ctx, b.cx, b.cy)

    ctx.textAlign = 'center'
    ctx.font = `600 11px ${FONT_STACK}`
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.fillText(b.label, b.cx, b.cy + b.r + 17)
  }

  ctx.restore()
}
