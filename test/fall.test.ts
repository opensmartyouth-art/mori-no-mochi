import { describe, expect, it } from 'vitest'
import { FIXED_DT, MAX_DIST, MIN_DIST } from '../src/config'
import {
  createWorld,
  press,
  release,
  target,
  update,
  type World,
} from '../src/game/world'

/**
 * 실패 낙하는 그루터기를 뚫고 지나가면 안 된다(GDD §6 — 모서리에서 미끄러져 떨어진다).
 *
 * 앞쪽 그루터기를 LOOKAHEAD 개씩 미리 깔아 두기 때문에, 빗나간 착지점이
 * 어떤 그루터기 윗면 **위**인 경우가 드물지 않다. 실측하면
 *   즉시 탭 실패의 절반,  최대 차지 실패의 절반
 * 이 그렇다. 그걸 그대로 통과시키면 모찌가 멀쩡한 발판을 뚫고 사라진다.
 */
/** TS 가 phase 를 좁혀버리지 않도록 한 겹 감싼다. hop() 이 상태를 바꾼다. */
const phaseOf = (w: World): string => w.phase

const req = (w: World): number => {
  const t = target(w)!
  return Math.hypot(t.wx - w.mochi.wx, t.wy - w.mochi.wy)
}

function hop(w: World, charge: number): void {
  press(w)
  w.charge = charge
  release(w)
  let n = 0
  while (w.phase === 'flying' && n < 2000) {
    update(w, FIXED_DT)
    n++
  }
}

/**
 * 낙하 중 그루터기 윗면을 위에서 아래로 가로질렀나.
 * 옆면 높이보다 아래를 지나는 건 깊이 정렬에 가려지므로 세지 않는다.
 */
function sinksThrough(w: World): boolean {
  let n = 0
  while (w.phase === 'falling' && n < 400) {
    const bx = w.mochi.wx
    const by = w.mochi.wy
    const bz = w.mochi.wz
    update(w, FIXED_DT)
    n++
    for (const s of w.stumps) {
      const inNow = Math.hypot(w.mochi.wx - s.wx, w.mochi.wy - s.wy) <= s.r
      const inBefore = Math.hypot(bx - s.wx, by - s.wy) <= s.r
      if (inNow && inBefore && bz >= s.h && w.mochi.wz < s.h) return true
    }
  }
  return false
}

const onTop = (w: World): boolean =>
  w.stumps.some((s) => Math.hypot(w.mochi.wx - s.wx, w.mochi.wy - s.wy) <= s.r)

describe('실패 낙하', () => {
  it('즉시 탭으로 빗나가도 윗면을 뚫지 않는다', () => {
    let fell = 0
    let landedOnTop = 0
    let through = 0
    for (let seed = 0; seed < 400; seed++) {
      const w = createWorld(seed)
      // 뒤쪽 가장자리에 서게 만든 뒤 바로 탭하면 자기 발판 위로 되돌아온다
      const ch = (req(w) - 0.5 * target(w)!.r - MIN_DIST) / (MAX_DIST - MIN_DIST)
      if (ch < 0 || ch > 1) continue
      hop(w, ch)
      if (phaseOf(w) !== 'idle') continue
      hop(w, 0)
      if (phaseOf(w) !== 'falling') continue
      fell++
      if (onTop(w)) landedOnTop++
      if (sinksThrough(w)) through++
    }
    expect(fell).toBeGreaterThan(50)
    // 이 상황이 실제로 자주 생긴다는 것 자체를 고정해 둔다
    expect(landedOnTop).toBeGreaterThan(fell * 0.2)
    expect(through).toBe(0)
  })

  it('최대 차지로 넘어가도 윗면을 뚫지 않는다', () => {
    let fell = 0
    let landedOnTop = 0
    let through = 0
    for (let seed = 0; seed < 600; seed++) {
      const w = createWorld(seed)
      hop(w, 1)
      if (phaseOf(w) !== 'falling') continue
      fell++
      if (onTop(w)) landedOnTop++
      if (sinksThrough(w)) through++
    }
    expect(fell).toBeGreaterThan(100)
    expect(landedOnTop).toBeGreaterThan(fell * 0.2)
    expect(through).toBe(0)
  })

  it('윗면에 걸친 뒤에는 결국 모서리를 벗어나 떨어진다', () => {
    let stuck = 0
    for (let seed = 0; seed < 400; seed++) {
      const w = createWorld(seed)
      hop(w, 1)
      if (phaseOf(w) !== 'falling') continue
      let n = 0
      while (phaseOf(w) === 'falling' && n < 400) {
        update(w, FIXED_DT)
        n++
      }
      // 발판 위에 영원히 머무르면 안 된다
      if (w.ground !== null) stuck++
    }
    expect(stuck).toBe(0)
  })
})
