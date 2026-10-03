import type { LoopStats } from '../engine/loop'
import { FONT_STACK } from '../config'

/** ?debug=1 일 때만 켜지는 개발용 계측. 기본 화면에는 그리지 않는다. */
export const DEBUG = new URLSearchParams(location.search).get('debug') === '1'

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
