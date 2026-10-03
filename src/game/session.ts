/**
 * 판을 넘어 남는 기록. 1차에서는 메모리에만 둔다.
 * localStorage 영구 저장은 GDD §11 2차(8단계)에서 붙인다.
 */
export interface Best {
  stumps: number
  combo: number
  score: number
}

let best: Best = { stumps: 0, combo: 0, score: 0 }

export const getBest = (): Best => best

export function submit(stumps: number, combo: number, score: number): Best {
  best = {
    stumps: Math.max(best.stumps, stumps),
    combo: Math.max(best.combo, combo),
    score: Math.max(best.score, score),
  }
  return best
}
