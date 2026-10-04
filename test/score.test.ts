import { describe, expect, it } from 'vitest'
import { PERFECT_MULT_CAP } from '../src/config'
import {
  applyLanding,
  createScore,
  stumpScore,
  totalScore,
  type ScoreState,
} from '../src/game/score'
import type { Judgement } from '../src/game/types'

/**
 * GDD §7 역산 테스트.
 *
 * 원작(ref/source.mp4)의 결과 카드:
 *   그루터기 12개 × 10        =  120
 *   퍼펙트 ×8 (최고 3연속)     = +140
 *   점수                       =  260
 *
 * 영상에서 "Perfect ×N" 라벨이 뜬 프레임을 읽으면 연속 횟수가 직접 보인다.
 *   8.1s  그루터기 1  → Perfect      (연속 1, ×N 표기 없음)
 *   9.6s  그루터기 2  → Perfect ×2
 *   11s   그루터기 3  → Perfect ×3
 *   17s   그루터기 7  → Perfect ×2
 *   19s   그루터기 8  → Perfect ×3
 *   20s   그루터기 10 → Perfect      (연속 1)
 *   23s   그루터기 12 → Perfect      (연속 1)
 * 여기서 연속 구간이 [3, 3, 1, 1] 로 복원된다.
 */
const RUN: Judgement[] = [
  'perfect', // 1  연속 1
  'perfect', // 2  연속 2
  'perfect', // 3  연속 3
  'ok', //      4  끊김
  'ok', //      5
  'perfect', // 6  연속 1
  'perfect', // 7  연속 2
  'perfect', // 8  연속 3
  'ok', //      9  끊김
  'perfect', // 10 연속 1
  'ok', //      11 끊김
  'perfect', // 12 연속 1
]

const play = (run: readonly Judgement[]): ScoreState =>
  run.reduce(applyLanding, createScore())

describe('원작 결과 카드 역산', () => {
  it('영상의 플레이를 그대로 넣으면 결과 카드 숫자가 전부 맞는다', () => {
    const s = play(RUN)
    expect(s.stumps).toBe(12)
    expect(s.perfects).toBe(8)
    expect(s.bestCombo).toBe(3)
    expect(stumpScore(s)).toBe(120)
    expect(s.perfectScore).toBe(140)
    expect(totalScore(s)).toBe(260)
  })

  it('퍼펙트 점수는 10 × 현재 연속 횟수다', () => {
    let s = createScore()
    s = applyLanding(s, 'perfect')
    expect(s.perfectScore).toBe(10)
    s = applyLanding(s, 'perfect')
    expect(s.perfectScore).toBe(10 + 20)
    s = applyLanding(s, 'perfect')
    expect(s.perfectScore).toBe(10 + 20 + 30)
    s = applyLanding(s, 'ok')
    expect(s.combo).toBe(0)
    s = applyLanding(s, 'perfect')
    expect(s.perfectScore).toBe(60 + 10)
  })

  /**
   * 라벨을 못 읽었더라도 카드 숫자만으로 분할이 하나로 정해지는지 확인한다.
   * 두 경로가 같은 답을 가리켜야 공식이 확정된 것이다.
   */
  it('퍼펙트 8회·최장 3연속에서 140점이 되는 연속 분할은 [3,3,1,1] 뿐이다', () => {
    const groups: number[][] = []
    const walk = (left: number, acc: number[]): void => {
      if (left === 0) {
        groups.push([...acc])
        return
      }
      for (let len = 1; len <= Math.min(3, left); len++) {
        acc.push(len)
        walk(left - len, acc)
        acc.pop()
      }
    }
    walk(8, [])

    const scoreOf = (g: number[]): number =>
      g.reduce((sum, len) => sum + ((len * (len + 1)) / 2) * 10, 0)

    const hits = new Set(
      groups
        .filter((g) => Math.max(...g) === 3 && scoreOf(g) === 140)
        .map((g) => [...g].sort((a, b) => b - a).join(',')),
    )
    expect([...hits]).toEqual(['3,3,1,1'])
  })

  /**
   * 배수 상한은 원작 데이터로 역산되지 않는다. 지금은 시험값 5 다.
   * 연속 횟수 기록 자체에는 상한이 없고 배수만 멈춘다.
   */
  it('배수는 연속 횟수를 따라가되 상한에서 멈춘다', () => {
    let s = createScore()
    let expected = 0
    for (let k = 1; k <= 20; k++) {
      s = applyLanding(s, 'perfect')
      expected += 10 * Math.min(k, PERFECT_MULT_CAP)
      // 연속 기록은 상한과 무관하게 계속 올라간다
      expect(s.combo).toBe(k)
      expect(s.bestCombo).toBe(k)
      expect(s.perfectScore).toBe(expected)
    }
  })

  it('상한이 원작 사례(최장 3연속)에는 닿지 않는다', () => {
    // 상한을 바꿔도 260점 재현이 깨지면 안 된다
    expect(PERFECT_MULT_CAP).toBeGreaterThanOrEqual(3)
    expect(play(RUN).perfectScore).toBe(140)
  })

  it('실패는 점수에도 개수에도 들어가지 않는다', () => {
    const s = play(['perfect', 'ok', 'miss'])
    expect(s.stumps).toBe(2)
    expect(totalScore(s)).toBe(30)
  })
})
