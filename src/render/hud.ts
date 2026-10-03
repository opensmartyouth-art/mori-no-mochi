import {
  COL_GOLD,
  COL_TEXT,
  DESIGN_W,
  FONT_STACK,
  LABEL_TIME,
} from '../config'
import { clamp01, easeOutCubic, mix } from '../engine/ease'
import { getBest } from '../game/session'
import type { World } from '../game/world'

/**
 * 플레이 중 표시(GDD §10).
 * 큰 숫자는 점수가 아니라 **그루터기 개수**다. 그 아래 Perfect ×N.
 * 차지 게이지는 그리지 않는다 — 스쿼시가 게이지다.
 */
export interface SafeArea {
  top: number
  bottom: number
}

/** 좌상단 기록. 타이틀에서도 그대로 보인다(원작처럼). */
export function drawRecords(
  ctx: CanvasRenderingContext2D,
  safe: SafeArea,
): void {
  const best = getBest()
  const t = safe.top
  ctx.save()
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.font = `600 11px ${FONT_STACK}`
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.fillText('최고', 20, 40 + t)
  ctx.font = `800 22px ${FONT_STACK}`
  ctx.fillStyle = COL_GOLD
  ctx.fillText(String(best.stumps), 48, 42 + t)
  ctx.font = `600 10px ${FONT_STACK}`
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText(`퍼펙트 ${best.combo}연속`, 20, 57 + t)
  ctx.restore()
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  w: World,
  safe: SafeArea,
): void {
  drawRecords(ctx, safe)

  ctx.save()
  ctx.textBaseline = 'alphabetic'

  // 중앙 상단 그루터기 개수
  ctx.textAlign = 'center'
  ctx.font = `800 40px ${FONT_STACK}`
  ctx.fillStyle = COL_TEXT
  ctx.fillText(String(w.score.stumps), DESIGN_W / 2, 122 + safe.top)

  // Perfect ×N — 연속 1 회는 ×N 없이 Perfect 만. 원작 표기 그대로다.
  if (w.label) {
    const t = clamp01(w.label.t / LABEL_TIME)
    const alpha = t < 0.55 ? 1 : 1 - easeOutCubic((t - 0.55) / 0.45)
    const rise = mix(6, 0, easeOutCubic(clamp01(w.label.t / 0.3)))
    const y = 158 + safe.top + rise
    ctx.globalAlpha = alpha
    ctx.fillStyle = COL_TEXT
    const n = w.label.combo
    if (n <= 1) {
      ctx.font = `800 19px ${FONT_STACK}`
      ctx.fillText('Perfect', DESIGN_W / 2, y)
    } else {
      ctx.font = `800 19px ${FONT_STACK}`
      const main = 'Perfect '
      const sub = `×${n}`
      const mw = ctx.measureText(main).width
      ctx.font = `700 13px ${FONT_STACK}`
      const sw = ctx.measureText(sub).width
      const left = DESIGN_W / 2 - (mw + sw) / 2
      ctx.textAlign = 'left'
      ctx.font = `800 19px ${FONT_STACK}`
      ctx.fillText(main, left, y)
      ctx.font = `700 13px ${FONT_STACK}`
      ctx.fillText(sub, left + mw, y)
      ctx.textAlign = 'center'
    }
    ctx.globalAlpha = 1
  }

  ctx.restore()
}
