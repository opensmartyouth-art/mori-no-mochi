import {
  COL_GOLD,
  HINT_DOT,
  HINT_HOLD,
  HINT_RISE,
  HINT_SPAN,
  HINT_TIME,
  HINT_W,
  PERFECT_MULT_CAP,
  PERFECT_R_RATIO,
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

/**
 * 착지 보정 눈금. 퍼펙트가 아닐 때 Perfect 라벨 자리에 잠깐 떴다 사라진다.
 *
 * 눈금 전체가 그루터기 지름이고, 가운데 밝은 구간이 퍼펙트 반경이다.
 * 점이 내가 내린 자리다. 세 가지를 한 번에 보여줘야 "다음엔 조금 덜 눌러야겠다"
 * 가 성립한다. 차지 중 스쿼시로는 이 폭을 읽을 수 없어서(퍼펙트 창이 2px)
 * 차지 중이 아니라 끝난 뒤에 답을 준다.
 *
 * 그루터기 위에 그려봤더니 착지점이 곧 모찌가 선 자리라 몸에 가려 안 보였다.
 */
function drawAimHint(
  ctx: CanvasRenderingContext2D,
  w: World,
  safe: SafeArea,
): void {
  const h = w.hint
  if (!h) return
  const x = clamp01(h.t / HINT_TIME)
  // 떴다가 **밝기를 유지하다가** 사라진다. 바로 꺼지면 읽을 시간이 없다.
  const alpha =
    x < HINT_RISE
      ? easeOutCubic(x / HINT_RISE)
      : x < HINT_HOLD
        ? 1
        : 1 - easeOutCubic((x - HINT_HOLD) / (1 - HINT_HOLD))
  if (alpha <= 0.01) return

  const cx = DESIGN_W / 2
  const y = 154 + safe.top
  const half = HINT_W / 2
  // 반지름이 아니라 고정 거리로 재야 점 위치가 항상 같은 누름 시간 오차를 뜻한다.
  const perPx = half / HINT_SPAN
  const edge = Math.min(h.r * perPx, half)
  const pr = h.r * PERFECT_R_RATIO * perPx
  const raw = h.d * perPx
  const over = raw > half
  const px = Math.min(raw, half) * (h.long ? 1 : -1)
  const tone = h.long ? '255, 206, 130' : '160, 214, 255'

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineCap = 'butt'

  // 잴 수 있는 전체 범위
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(cx - half, y)
  ctx.lineTo(cx + half, y)
  ctx.stroke()

  // 이번 그루터기의 폭 — 여기 안이면 살아남는다
  ctx.strokeStyle = 'rgba(255,255,255,0.38)'
  ctx.beginPath()
  ctx.moveTo(cx - edge, y)
  ctx.lineTo(cx + edge, y)
  ctx.stroke()

  // 퍼펙트 구간
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.beginPath()
  ctx.moveTo(cx - pr, y)
  ctx.lineTo(cx + pr, y)
  ctx.stroke()

  // 내가 내린 자리. 눈금 밖으로 벗어났으면 삼각형으로 '더 멀리' 를 알린다
  ctx.fillStyle = `rgba(${tone}, 1)`
  ctx.beginPath()
  if (over) {
    const s = h.long ? 1 : -1
    ctx.moveTo(cx + px + s * 5, y)
    ctx.lineTo(cx + px - s * 3, y - 4)
    ctx.lineTo(cx + px - s * 3, y + 4)
    ctx.closePath()
  } else {
    ctx.arc(cx + px, y, HINT_DOT, 0, Math.PI * 2)
  }
  ctx.fill()

  // 좌우가 무슨 뜻인지는 설명되지 않는다. 글자로 못박는다.
  ctx.textAlign = 'center'
  ctx.font = `700 11px ${FONT_STACK}`
  ctx.fillStyle = `rgba(${tone}, 0.95)`
  ctx.fillText(h.long ? '길었다' : '짧았다', cx, y + 18)

  ctx.globalAlpha = 1
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

  drawAimHint(ctx, w, safe)

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
      // 원작은 ×N 이 곧 점수 배수였다. 상한을 둔 뒤로는 둘이 갈라지므로
      // ×N 으로 쓰면 숫자가 실제 점수를 속이게 된다. 연속 기록으로 적는다.
      ctx.font = `800 19px ${FONT_STACK}`
      const main = 'Perfect '
      const sub = n > PERFECT_MULT_CAP ? `${n}연속` : `×${n}`
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
