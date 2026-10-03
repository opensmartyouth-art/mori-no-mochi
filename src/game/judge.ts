import { PERFECT_R_RATIO } from '../config'
import type { Judgement } from './types'

export interface JudgeResult {
  verdict: Judgement
  /** 그루터기 중심까지의 평면 거리. */
  d: number
  /** 이번 판정에 쓰인 퍼펙트 반경. */
  perfectR: number
}

/**
 * 착지 판정(GDD §6). 순수 함수.
 *   d <= PERFECT_R   → perfect
 *   d <= stumpRadius → ok
 *   그 외            → miss
 */
export function judgeLanding(
  landX: number,
  landY: number,
  stumpX: number,
  stumpY: number,
  stumpR: number,
  perfectRatio: number = PERFECT_R_RATIO,
): JudgeResult {
  const dx = landX - stumpX
  const dy = landY - stumpY
  const d = Math.hypot(dx, dy)
  const perfectR = stumpR * perfectRatio
  const verdict: Judgement = d <= perfectR ? 'perfect' : d <= stumpR ? 'ok' : 'miss'
  return { verdict, d, perfectR }
}
