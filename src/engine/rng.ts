/** 결정적 난수(mulberry32). 테스트와 재현 가능한 플레이를 위해 시드를 받는다. */
export interface Rng {
  next(): number
  range(lo: number, hi: number): number
  pick<T>(items: readonly T[]): T
  chance(p: number): boolean
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    pick: (items) => items[Math.floor(next() * items.length)]!,
    chance: (p) => next() < p,
  }
}
