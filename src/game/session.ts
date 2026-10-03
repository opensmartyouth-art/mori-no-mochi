/** 판을 넘어 남는 기록. localStorage 에 저장한다(GDD §7). */
export interface Best {
  stumps: number
  combo: number
  score: number
}

const KEY = 'mori-no-mochi.best.v1'
const EMPTY: Best = { stumps: 0, combo: 0, score: 0 }

const num = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0

function read(): Best {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }
    const o = JSON.parse(raw) as Partial<Best>
    return { stumps: num(o.stumps), combo: num(o.combo), score: num(o.score) }
  } catch {
    // 사생활 보호 모드나 저장 차단 환경. 기록 없이도 게임은 돌아가야 한다.
    return { ...EMPTY }
  }
}

let best: Best = read()

export const getBest = (): Best => best

export function submit(stumps: number, combo: number, score: number): Best {
  best = {
    stumps: Math.max(best.stumps, stumps),
    combo: Math.max(best.combo, combo),
    score: Math.max(best.score, score),
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(best))
  } catch {
    // 저장 못 해도 이번 판 표시는 맞아야 하므로 메모리 값은 유지한다.
  }
  return best
}
