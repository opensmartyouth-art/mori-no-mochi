import { COL_TEXT, DESIGN_H, DESIGN_W, FONT_STACK } from '../config'
import { clamp01, easeOutCubic, mix } from '../engine/ease'
import type { SafeArea } from './hud'

/** 일본어 둥근 고딕. 없으면 기본 스택으로 떨어진다. */
const JP_FONT =
  '"Hiragino Maru Gothic ProN", "Hiragino Sans", "Yu Gothic", ' + FONT_STACK

function letterSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
): void {
  const chars = [...text]
  const widths = chars.map((c) => ctx.measureText(c).width)
  const total =
    widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)
  let cx = x - total / 2
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i]!, cx, y)
    cx += widths[i]! + spacing
  }
}

/**
 * 타이틀(GDD §10). 뒤에는 월드가 그대로 보인다.
 * 튜토리얼은 "꾹 눌렀다가 떼면 점프" 한 줄이 전부다.
 */
export function drawTitle(
  ctx: CanvasRenderingContext2D,
  t: number,
  safe: SafeArea,
): void {
  const k = easeOutCubic(clamp01(t / 0.5))
  ctx.save()
  ctx.globalAlpha = k
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  ctx.translate(0, mix(10, 0, k))

  ctx.fillStyle = COL_TEXT
  ctx.font = `800 46px ${JP_FONT}`
  letterSpaced(ctx, 'もりのもち', DESIGN_W / 2, 152 + safe.top, 2)

  ctx.font = `600 9px ${FONT_STACK}`
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  letterSpaced(ctx, 'MORI NO MOCHI · 숲속의 모찌', DESIGN_W / 2, 176 + safe.top, 2.6)

  // 하단 안내
  ctx.textAlign = 'center'
  ctx.font = `600 13px ${FONT_STACK}`
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  const hintY = DESIGN_H - 118 - safe.bottom
  ctx.fillText('꾹 눌렀다가 떼면 점프', DESIGN_W / 2 + 10, hintY)

  const dotX = DESIGN_W / 2 + 10 - ctx.measureText('꾹 눌렀다가 떼면 점프').width / 2 - 16
  const dotY = hintY - 4
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(dotX, dotY, 6, 0, Math.PI * 2)
  ctx.stroke()
  // 누르는 중처럼 안쪽을 채워 둔다
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.beginPath()
  ctx.arc(dotX, dotY, 2.6, 0, Math.PI * 2)
  ctx.fill()

  ctx.font = `500 10px ${FONT_STACK}`
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  const label = '개인정보처리방침'
  const privY = DESIGN_H - 66 - safe.bottom
  ctx.fillText(label, DESIGN_W / 2, privY)
  const lw = ctx.measureText(label).width
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(DESIGN_W / 2 - lw / 2, privY + 3)
  ctx.lineTo(DESIGN_W / 2 + lw / 2, privY + 3)
  ctx.stroke()

  ctx.restore()
}
