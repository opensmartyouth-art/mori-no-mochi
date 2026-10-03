import { describe, expect, it } from 'vitest'
import {
  DESIGN_H,
  DESIGN_W,
  FIXED_DT,
  MAX_DIST,
  MIN_DIST,
} from '../src/config'
import { panFor, stumpFocus } from '../src/game/camera'
import { isoEllipse, project } from '../src/game/iso'
import { createRng } from '../src/engine/rng'
import { clamp01 } from '../src/engine/ease'
import {
  createWorld,
  press,
  release,
  target,
  update,
  type World,
} from '../src/game/world'
import { difficulty } from '../src/game/spawn'

/** 다음 그루터기 중심까지의 거리. */
function required(w: World): number {
  const t = target(w)!
  return Math.hypot(t.wx - w.mochi.wx, t.wy - w.mochi.wy)
}

function settle(w: World, maxSteps = 1200): void {
  let n = 0
  while (w.phase !== 'idle' && w.phase !== 'over' && n < maxSteps) {
    update(w, FIXED_DT)
    n++
  }
  if (w.phase === 'idle') update(w, FIXED_DT)
}

/** 필요한 만큼만 정확히 차지해서 뛴다. offset 을 주면 일부러 빗나간다. */
function jump(w: World, offset = 0): void {
  const req = required(w) + offset
  press(w)
  w.charge = clamp01((req - MIN_DIST) / (MAX_DIST - MIN_DIST))
  release(w)
  settle(w)
}

describe('무한 진행과 그루터기 회수', () => {
  it('80번 연속 퍼펙트로 뛰어도 끊기지 않는다', () => {
    const w = createWorld(12345)
    for (let i = 0; i < 80; i++) {
      expect(w.phase).toBe('idle')
      jump(w)
    }
    expect(w.phase).toBe('idle')
    expect(w.score.stumps).toBe(80)
    expect(w.score.perfects).toBe(80)
    expect(w.score.combo).toBe(80)
    expect(w.score.bestCombo).toBe(80)
  })

  it('지나간 그루터기를 버려서 배열이 무한히 자라지 않는다', () => {
    const w = createWorld(999)
    let peak = 0
    for (let i = 0; i < 120; i++) {
      jump(w)
      peak = Math.max(peak, w.stumps.length)
    }
    expect(w.score.stumps).toBe(120)
    expect(peak).toBeLessThan(24)
    // 앞을 버려도 현재 위치와 다음 목표는 항상 남아 있어야 한다
    expect(w.stumps[w.curIdx]).toBeDefined()
    expect(target(w)).toBeDefined()
  })

  it('중심에 딱 맞춰 뛰면 필요 거리는 항상 차지 범위 안이다', () => {
    const w = createWorld(4242)
    for (let i = 0; i < 200; i++) {
      const req = required(w)
      expect(req).toBeGreaterThanOrEqual(MIN_DIST - 1e-9)
      expect(req).toBeLessThanOrEqual(MAX_DIST + 1e-9)
      jump(w)
    }
  })

  // 그루터기를 앞쪽까지 미리(중심 기준) 만들기 때문에, 모찌가 중심에서
  // 벗어나 서 있으면 다음에 필요한 거리가 생성 거리와 달라진다.
  // 그 폭을 차지 범위가 덮지 못하면 도달 불가가 생긴다. 여기가 제일 위험한 지점이다.
  it('가장자리에 아슬아슬하게 착지해도 다음 점프가 도달 가능하다', () => {
    for (let seed = 0; seed < 60; seed++) {
      const w = createWorld(seed)
      const rng = createRng(seed ^ 0x5bf03)
      for (let i = 0; i < 80; i++) {
        const req = required(w)
        expect(req).toBeGreaterThanOrEqual(MIN_DIST - 1e-9)
        expect(req).toBeLessThanOrEqual(MAX_DIST + 1e-9)
        // 성공 판정이 유지되는 한계까지 밀어붙인다
        const edge = target(w)!.r * 0.985
        jump(w, rng.range(-edge, edge))
        if (w.phase !== 'idle') throw new Error(`seed ${seed} i ${i}: ${w.phase}`)
      }
    }
  })

  // 기대값을 LOOKAHEAD 로 쓰면 상수를 0 으로 낮춰도 통과한다. 리터럴로 고정한다.
  it('현재 발판 앞으로 최소 4개가 항상 깔려 있다', () => {
    const w = createWorld(31337)
    for (let i = 0; i < 40; i++) {
      expect(w.stumps.length - w.curIdx - 1).toBeGreaterThanOrEqual(4)
      jump(w)
    }
  })

  // 배열 길이만 보면 회수가 멈춰도 잡히지 않을 수 있다.
  // 뒤쪽이 실제로 떨어져 나가는지는 curIdx 가 묶여 있는 것으로 확인한다.
  it('뒤쪽이 실제로 떨어져 나가 curIdx 가 묶인다', () => {
    const w = createWorld(555)
    for (let i = 0; i < 100; i++) jump(w)
    expect(w.score.stumps).toBe(100)
    expect(w.curIdx).toBeLessThanOrEqual(14)
    expect(w.stumps[0]!.index).toBeGreaterThan(80)
  })
})

describe('카메라', () => {
  // GDD §9 — 다음 그루터기가 화면 밖에 있으면 어디로 뛸지 알 수 없다.
  // 가장자리에 아슬아슬하게 착지해 모찌가 중심에서 벗어난 상태까지 본다.
  it('카메라가 자리 잡으면 다음 그루터기는 언제나 화면 안이다', () => {
    for (let seed = 0; seed < 30; seed++) {
      const w = createWorld(seed)
      const rng = createRng(seed ^ 0x2c0ffee)
      for (let i = 0; i < 60; i++) {
        const pan = panFor(stumpFocus(w.stumps[w.curIdx]!))
        const t = target(w)!
        const p = project(t.wx, t.wy, t.h)
        const e = isoEllipse(t.r)
        expect(p.x + pan.x - e.x).toBeGreaterThan(0)
        expect(p.x + pan.x + e.x).toBeLessThan(DESIGN_W)
        expect(p.y + pan.y - e.y).toBeGreaterThan(0)
        expect(p.y + pan.y + e.y).toBeLessThan(DESIGN_H)
        jump(w, rng.range(-t.r * 0.985, t.r * 0.985))
      }
    }
  })
})

describe('난이도 커브', () => {
  it('초반 10개는 난이도 0, 이후 완만하게 오른다', () => {
    expect(difficulty(0)).toBe(0)
    expect(difficulty(10)).toBe(0)
    expect(difficulty(11)).toBeGreaterThan(0)
    expect(difficulty(27)).toBeGreaterThan(difficulty(20))
    expect(difficulty(45)).toBe(1)
    expect(difficulty(200)).toBe(1)
  })

  it('뒤로 갈수록 평균 거리가 늘고 반지름이 준다', () => {
    const early: number[] = []
    const late: number[] = []
    const earlyR: number[] = []
    const lateR: number[] = []
    for (let seed = 0; seed < 40; seed++) {
      const w = createWorld(seed)
      for (let i = 0; i < 60; i++) {
        const req = required(w)
        const r = target(w)!.r
        if (i < 10) {
          early.push(req)
          earlyR.push(r)
        } else if (i >= 50) {
          late.push(req)
          lateR.push(r)
        }
        jump(w)
      }
    }
    const avg = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length
    expect(avg(late)).toBeGreaterThan(avg(early))
    expect(avg(lateR)).toBeLessThan(avg(earlyR))
  })
})

describe('실패', () => {
  it('크게 빗나가면 낙하하고 결과로 넘어간다', () => {
    const w = createWorld(7)
    jump(w)
    expect(w.phase).toBe('idle')
    jump(w, 1.4)
    expect(w.lastVerdict).toBe('miss')
    let n = 0
    while (w.phase !== 'over' && n < 2000) {
      update(w, FIXED_DT)
      n++
    }
    expect(w.phase).toBe('over')
    // 실패한 점프는 점수에 들어가지 않는다
    expect(w.score.stumps).toBe(1)
  })
})
