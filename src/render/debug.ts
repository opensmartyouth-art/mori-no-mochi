import type { LoopStats } from '../engine/loop'
import { FONT_STACK } from '../config'

const params = new URLSearchParams(location.search)

/** ?debug=1 일 때만 켜지는 개발용 계측. 기본 화면에는 그리지 않는다. */
export const DEBUG = params.get('debug') === '1'

/**
 * ?slow=N — 디버그에서만 시간을 N배 느리게 돌린다.
 * 착지 먼지나 퍼펙트 링처럼 0.5초 안에 끝나는 연출을 눈으로 확인하려면 필요하다.
 */
export const TIME_SCALE = (() => {
  if (!DEBUG) return 1
  const n = Number(params.get('slow'))
  return Number.isFinite(n) && n >= 1 ? 1 / n : 1
})()

export function drawDebug(
  ctx: CanvasRenderingContext2D,
  stats: LoopStats,
  extra = '',
): void {
  if (!DEBUG) return
  ctx.save()
  ctx.font = `500 11px ${FONT_STACK}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const line = `${stats.fps.toFixed(1)} fps · ${stats.frameMs.toFixed(1)} ms · 렌더 ${stats.renderMs.toFixed(2)} ms · x${stats.steps}${extra ? ' · ' + extra : ''}`
  const w = ctx.measureText(line).width + 12
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(8, 8, w, 20)
  ctx.fillStyle = '#9ef5a0'
  ctx.fillText(line, 14, 13)
  ctx.restore()
}
