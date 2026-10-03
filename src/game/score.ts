import { PERFECT_BASE, PERFECT_MULT_CAP, STUMP_SCORE } from '../config'
import type { Judgement } from './types'

/**
 * 스코어(GDD §7). 원작 결과 카드에서 역산한 구조.
 *
 *   그루터기 1개            = 10점
 *   퍼펙트 1회              = 10점 × 현재 연속 횟수
 *
 * 연속 횟수는 퍼펙트마다 1씩 오르고, 퍼펙트가 아니면 0으로 끊긴다.
 * ref/source.mp4 의 플레이에서 연속 구간은 [3, 3, 1, 1] (총 8회, 최장 3연속)이고
 *   (1+2+3) + (1+2+3) + 1 + 1 = 14 → 140점
 * 으로 결과 카드의 +140 과 일치한다. test/score.test.ts 가 이걸 고정한다.
 */
export interface ScoreState {
  /** 착지 성공한 그루터기 수. 시작 그루터기는 세지 않는다. */
  stumps: number
  /** 퍼펙트 총 횟수. */
  perfects: number
  /** 현재 연속 퍼펙트 횟수. 0 이면 끊긴 상태. */
  combo: number
  /** 이번 판에서 가장 길었던 연속. */
  bestCombo: number
  /** 퍼펙트로 얻은 점수만. */
  perfectScore: number
}

export const createScore = (): ScoreState => ({
  stumps: 0,
  perfects: 0,
  combo: 0,
  bestCombo: 0,
  perfectScore: 0,
})

/** 착지 한 번을 반영한 새 상태를 돌려준다. miss 는 점수에 영향이 없다. */
export function applyLanding(s: ScoreState, verdict: Judgement): ScoreState {
  if (verdict === 'miss') return s

  const stumps = s.stumps + 1
  if (verdict !== 'perfect') {
    return { ...s, stumps, combo: 0 }
  }

  const combo = s.combo + 1
  const mult = Math.min(combo, PERFECT_MULT_CAP)
  return {
    stumps,
    perfects: s.perfects + 1,
    combo,
    bestCombo: Math.max(s.bestCombo, combo),
    perfectScore: s.perfectScore + PERFECT_BASE * mult,
  }
}

export const stumpScore = (s: ScoreState): number => s.stumps * STUMP_SCORE

export const totalScore = (s: ScoreState): number =>
  stumpScore(s) + s.perfectScore
