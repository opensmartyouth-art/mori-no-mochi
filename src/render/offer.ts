import {
  COL_CARD_INK,
  COL_INK,
  DESIGN_H,
  DESIGN_W,
  FONT_STACK,
} from '../config'
import { clamp01, easeOutCubic, mix } from '../engine/ease'
import type { World } from '../game/world'
import { mochiFace, roundRectPath } from './result'

/**
 * 떨어진 뒤 "광고 보고 이어하기" 를 묻는 화면.
 *
 * 결과 카드보다 먼저 뜬다. 여기서 보여줄 것은 점수 내역이 아니라
 * **지금 잃게 되는 것 하나**다 — 쌓아 올린 그루터기 수.
 * 내역을 보여주면 이미 끝난 판처럼 읽혀서 이어할 이유가 사라진다.
 */
const CARD_W = 300
const CARD_H = 176
const CARD_X = (DESIGN_W - CARD_W) / 2
const CARD_Y = 318

const BTN_W = 244
const BTN_H = 50
const BTN_X = (DESIGN_W - BTN_W) / 2
const BTN_Y = CARD_Y + CARD_H + 22

const QUIT_Y = BTN_Y + BTN_H + 36

export type OfferButton = 'continue' | 'quit'

export function hitOffer(x: number, y: number): OfferButton | null {
  if (
    x >= BTN_X - 8 &&
    x <= BTN_X + BTN_W + 8 &&
    y >= BTN_Y - 8 &&
    y <= BTN_Y + BTN_H + 8
  ) {
    return 'continue'
  }
  if (Math.abs(x - DESIGN_W / 2) <= 70 && Math.abs(y - QUIT_Y) <= 22) {
    return 'quit'
  }
  return null
}

export interface OfferOpts {
  scrim?: { x: number; y: number; w: number; h: number }
  /** 광고를 불러오거나 재생하는 중. 버튼을 누를 수 없다. */
  pending?: boolean
}

export function drawOffer(
  ctx: CanvasRenderingContext2D,
  w: World,
  t: number,
  opts: OfferOpts = {},
): void {
  const k = easeOutCubic(clamp01(t / 0.3))
  const sc = opts.scrim ?? { x: 0, y: 0, w: DESIGN_W, h: DESIGN_H }

  ctx.save()
  ctx.globalAlpha = k
  ctx.fillStyle = 'rgba(28, 33, 18, 0.42)'
  ctx.fillRect(sc.x, sc.y, sc.w, sc.h)
  ctx.translate(0, mix(18, 0, k))

  mochiFace(ctx, DESIGN_W / 2, CARD_Y - 11)

  ctx.fillStyle = COL_CARD_INK
  roundRectPath(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 26)
  ctx.fill()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `600 12px ${FONT_STACK}`
  ctx.fillStyle = 'rgba(47, 53, 36, 0.55)'
  ctx.fillText('여기까지', DESIGN_W / 2, CARD_Y + 52)

  ctx.font = `800 54px ${FONT_STACK}`
  ctx.fillStyle = COL_INK
  ctx.fillText(String(w.score.stumps), DESIGN_W / 2, CARD_Y + 108)

  ctx.font = `600 13px ${FONT_STACK}`
  ctx.fillStyle = 'rgba(47, 53, 36, 0.55)'
  ctx.fillText('그루터기 · 한 번 더 이어갈 수 있어요', DESIGN_W / 2, CARD_Y + 140)

  // 이어하기 — 유일한 주 행동이라 가장 눈에 띄게
  ctx.globalAlpha = k * (opts.pending ? 0.5 : 1)
  ctx.fillStyle = COL_CARD_INK
  roundRectPath(ctx, BTN_X, BTN_Y, BTN_W, BTN_H, BTN_H / 2)
  ctx.fill()

  ctx.fillStyle = COL_INK
  ctx.font = `800 15px ${FONT_STACK}`
  ctx.fillText(
    opts.pending ? '광고 불러오는 중…' : '광고 보고 이어하기',
    DESIGN_W / 2,
    BTN_Y + BTN_H / 2 + 5,
  )

  ctx.globalAlpha = k
  ctx.font = `600 13px ${FONT_STACK}`
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.fillText('그만두기', DESIGN_W / 2, QUIT_Y + 5)

  ctx.globalAlpha = 1
  ctx.restore()
}
