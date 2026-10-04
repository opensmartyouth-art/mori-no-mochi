import { describe, expect, it } from 'vitest'
import {
  CHARGE_TIME,
  FIXED_DT,
  MAX_DIST,
  MIN_DIST,
  PERFECT_R_RATIO,
} from '../src/config'
import { chargeToDistance, samplePos } from '../src/game/jump'
import { judgeLanding } from '../src/game/judge'
import {
  cancelCharge,
  createWorld,
  declineContinue,
  press,
  release,
  revive,
  target,
  update,
  type World,
} from '../src/game/world'

const phaseOf = (w: World): string => w.phase

/**
 * 차지 적분. 이 테스트가 없으면 차지 속도를 0 으로 만들어도 전부 통과한다.
 * (feel.test.ts 는 config 상수로 산술만 해서 런타임이 그 값을 쓰는지 모른다)
 */
describe('차지', () => {
  it('누르고 있는 동안 시간에 비례해 찬다', () => {
    const w = createWorld(1)
    press(w)
    expect(phaseOf(w)).toBe('charging')
    for (let i = 0; i < 20; i++) update(w, FIXED_DT)
    expect(w.charge).toBeCloseTo((20 * FIXED_DT) / CHARGE_TIME, 6)
    for (let i = 0; i < 20; i++) update(w, FIXED_DT)
    expect(w.charge).toBeCloseTo((40 * FIXED_DT) / CHARGE_TIME, 6)
  })

  it('CHARGE_TIME 이 지나면 1 에서 멈춘다', () => {
    const w = createWorld(2)
    press(w)
    const steps = Math.ceil(CHARGE_TIME / FIXED_DT) + 30
    for (let i = 0; i < steps; i++) update(w, FIXED_DT)
    expect(w.charge).toBe(1)
  })

  it('떼면 그때 찬 만큼의 거리로 날아간다', () => {
    const w = createWorld(3)
    press(w)
    for (let i = 0; i < 25; i++) update(w, FIXED_DT)
    const held = w.charge
    release(w)
    expect(phaseOf(w)).toBe('flying')
    expect(w.plan!.dist).toBeCloseTo(
      chargeToDistance(held, MIN_DIST, MAX_DIST),
      9,
    )
  })

  it('cancelCharge 는 점프시키지 않고 차지만 버린다', () => {
    const w = createWorld(4)
    press(w)
    for (let i = 0; i < 20; i++) update(w, FIXED_DT)
    cancelCharge(w)
    expect(phaseOf(w)).toBe('idle')
    expect(w.charge).toBe(0)
    expect(w.plan).toBeNull()
  })

  /**
   * overT 는 낙하 경과와 결과카드 경과를 겸한다. 전환 때 리셋하지 않으면
   * 카드가 FALL_TIME 만큼 지난 상태로 시작해서 등장 연출(0.42s)이 통째로
   * 생략되고, main.ts 의 오탭 방지 0.45초 가드도 한 프레임도 작동하지 않는다.
   */
  it('결과로 넘어가는 순간 화면 타이머가 0 에서 시작한다', () => {
    const w = createWorld(9)
    press(w)
    w.charge = 1
    release(w)
    let n = 0
    while (phaseOf(w) !== 'offer' && n < 3000) {
      update(w, FIXED_DT)
      n++
    }
    // 떨어지면 먼저 이어하기를 묻는다
    expect(phaseOf(w)).toBe('offer')
    expect(w.lastVerdict).toBe('miss')
    expect(w.overT).toBeLessThan(FIXED_DT * 2)
    // 거절하면 결과 카드, 그때도 타이머는 0 에서 시작한다
    declineContinue(w)
    expect(phaseOf(w)).toBe('over')
    expect(w.overT).toBe(0)
  })

  it('cancelCharge 는 비행 중에는 아무 것도 하지 않는다', () => {
    const w = createWorld(5)
    press(w)
    for (let i = 0; i < 20; i++) update(w, FIXED_DT)
    release(w)
    const before = { x: w.mochi.wx, z: w.mochi.wz }
    cancelCharge(w)
    expect(phaseOf(w)).toBe('flying')
    expect(w.mochi.wx).toBe(before.x)
    expect(w.mochi.wz).toBe(before.z)
  })
})

/**
 * 광고 보고 이어하기.
 * 플랫폼이 게임에 권장하는 수익 모델이지만, 이 게임의 정체성은
 * "한 번 빗나가면 끝" 이라 기록이 거짓이 되지 않게 지켜야 할 것이 있다.
 */
describe('이어하기', () => {
  const dieOnce = (w: World): void => {
    press(w)
    w.charge = 1
    release(w)
    let n = 0
    while (phaseOf(w) !== 'offer' && phaseOf(w) !== 'over' && n < 3000) {
      update(w, FIXED_DT)
      n++
    }
  }

  it('떨어지면 결과 카드 전에 먼저 묻는다', () => {
    const w = createWorld(21)
    dieOnce(w)
    expect(phaseOf(w)).toBe('offer')
    expect(w.continues).toBe(0)
  })

  it('이어하면 떨어지기 직전 발판 한가운데로 돌아간다', () => {
    const w = createWorld(22)
    // 한 번 성공해서 curIdx 를 옮긴 뒤 죽는다
    press(w)
    w.charge =
      (Math.hypot(target(w)!.wx - w.mochi.wx, target(w)!.wy - w.mochi.wy) -
        MIN_DIST) /
      (MAX_DIST - MIN_DIST)
    release(w)
    let n = 0
    while (phaseOf(w) === 'flying' && n < 500) {
      update(w, FIXED_DT)
      n++
    }
    const stood = w.stumps[w.curIdx]!
    const before = w.score.stumps
    dieOnce(w)
    revive(w)
    expect(phaseOf(w)).toBe('idle')
    expect(w.mochi.wx).toBe(stood.wx)
    expect(w.mochi.wy).toBe(stood.wy)
    expect(w.mochi.wz).toBe(stood.h)
    // 쌓은 그루터기는 그대로 이어진다
    expect(w.score.stumps).toBe(before)
    expect(w.continues).toBe(1)
  })

  it('이어해도 퍼펙트 연속은 끊긴다', () => {
    const w = createWorld(23)
    // 퍼펙트로 두 번 올라간 뒤 죽는다
    for (let i = 0; i < 2; i++) {
      const t = target(w)!
      press(w)
      w.charge =
        (Math.hypot(t.wx - w.mochi.wx, t.wy - w.mochi.wy) - MIN_DIST) /
        (MAX_DIST - MIN_DIST)
      release(w)
      let n = 0
      while (phaseOf(w) === 'flying' && n < 500) {
        update(w, FIXED_DT)
        n++
      }
    }
    expect(w.score.combo).toBeGreaterThan(0)
    const best = w.score.bestCombo
    dieOnce(w)
    revive(w)
    // 떨어졌는데 연속이 이어지면 기록이 거짓이 된다
    expect(w.score.combo).toBe(0)
    // 이미 세운 최장 기록은 남는다
    expect(w.score.bestCombo).toBe(best)
  })

  it('한 판에 한 번만 쓸 수 있고, 그 뒤엔 바로 결과로 간다', () => {
    const w = createWorld(24)
    dieOnce(w)
    revive(w)
    expect(w.continues).toBe(1)
    dieOnce(w)
    // 두 번째 죽음에는 묻지 않는다
    expect(phaseOf(w)).toBe('over')
    revive(w)
    expect(phaseOf(w)).toBe('over')
    expect(w.continues).toBe(1)
  })

  it('거절하면 결과로 가고 이어하기 횟수는 그대로다', () => {
    const w = createWorld(25)
    dieOnce(w)
    declineContinue(w)
    expect(phaseOf(w)).toBe('over')
    expect(w.continues).toBe(0)
  })

  it('이어한 뒤 다시 정상으로 뛸 수 있다', () => {
    const w = createWorld(26)
    dieOnce(w)
    revive(w)
    const t = target(w)!
    press(w)
    w.charge =
      (Math.hypot(t.wx - w.mochi.wx, t.wy - w.mochi.wy) - MIN_DIST) /
      (MAX_DIST - MIN_DIST)
    release(w)
    let n = 0
    while (phaseOf(w) === 'flying' && n < 500) {
      update(w, FIXED_DT)
      n++
    }
    expect(phaseOf(w)).toBe('idle')
    expect(w.lastVerdict).toBe('perfect')
  })
})

/**
 * 포물선이 착지 시각에 정확히 목표 윗면 높이에 닿아야 한다.
 * 어긋나면 착지 순간 모찌가 수직으로 순간이동한다.
 */
describe('점프 포물선', () => {
  it('체공시간이 끝나는 순간 목표 높이에 닿는다', () => {
    for (let seed = 0; seed < 50; seed++) {
      const w = createWorld(seed)
      const tgt = target(w)!
      press(w)
      w.charge = 0.5
      release(w)
      const end = samplePos(w.plan!, w.plan!.airTime)
      expect(end.wz).toBeCloseTo(tgt.h, 9)
    }
  })

  it('높이가 다른 그루터기로 뛰어도 마찬가지다', () => {
    let lower = 0
    let higher = 0
    for (let seed = 0; seed < 300; seed++) {
      const w = createWorld(seed)
      // 시작 그루터기는 항상 낮은 쪽이라, 한 번 뛰어 높이를 섞는다
      const first = target(w)!
      press(w)
      w.charge =
        (Math.hypot(first.wx - w.mochi.wx, first.wy - w.mochi.wy) - MIN_DIST) /
        (MAX_DIST - MIN_DIST)
      release(w)
      let n = 0
      while (phaseOf(w) === 'flying' && n < 500) {
        update(w, FIXED_DT)
        n++
      }
      if (phaseOf(w) !== 'idle') continue

      const tgt = target(w)!
      const from = w.mochi.wz
      press(w)
      w.charge = 0.7
      release(w)
      expect(samplePos(w.plan!, w.plan!.airTime).wz).toBeCloseTo(tgt.h, 9)
      if (tgt.h < from) lower++
      if (tgt.h > from) higher++
    }
    // 올라가는 경우와 내려오는 경우가 실제로 섞여 있어야 의미가 있다
    expect(lower).toBeGreaterThan(0)
    expect(higher).toBeGreaterThan(0)
  })
})

/**
 * 판정 경계. 이 테스트가 없으면 모든 착지를 perfect 로 만들어도,
 * 반대로 perfect 를 불가능하게 만들어도 전부 통과한다.
 */
describe('착지 판정 경계', () => {
  const R = 1.0
  const ratio = 0.3
  const PR = R * ratio

  it('퍼펙트 반경 안쪽은 perfect, 바깥은 ok', () => {
    expect(judgeLanding(PR - 1e-6, 0, 0, 0, R, ratio).verdict).toBe('perfect')
    expect(judgeLanding(PR, 0, 0, 0, R, ratio).verdict).toBe('perfect')
    expect(judgeLanding(PR + 1e-6, 0, 0, 0, R, ratio).verdict).toBe('ok')
  })

  it('그루터기 반지름 안쪽은 ok, 바깥은 miss', () => {
    expect(judgeLanding(R - 1e-6, 0, 0, 0, R, ratio).verdict).toBe('ok')
    expect(judgeLanding(R, 0, 0, 0, R, ratio).verdict).toBe('ok')
    expect(judgeLanding(R + 1e-6, 0, 0, 0, R, ratio).verdict).toBe('miss')
  })

  it('정중앙은 perfect, 방향과 무관하다', () => {
    expect(judgeLanding(0, 0, 0, 0, R, ratio).verdict).toBe('perfect')
    const d = PR * 0.7
    for (const [x, y] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
      expect(judgeLanding(x!, y!, 0, 0, R, ratio).verdict).toBe('perfect')
    }
    // 판정은 축이 아니라 합성거리로 한다. 각 축으로는 반경 안이라도
    // 대각선으로 합치면 넘어가는 지점이 있어야 한다.
    const e = PR * 0.8
    expect(judgeLanding(e, 0, 0, 0, R, ratio).verdict).toBe('perfect')
    expect(judgeLanding(e, e, 0, 0, R, ratio).verdict).toBe('ok')
  })

  it('기본 퍼펙트 비율은 GDD §6 이 말한 25~30% 안에 있다', () => {
    expect(PERFECT_R_RATIO).toBeGreaterThanOrEqual(0.25)
    expect(PERFECT_R_RATIO).toBeLessThanOrEqual(0.3)
  })

  it('기본값으로도 경계가 같은 모양이다', () => {
    const r = 0.86
    const pr = r * PERFECT_R_RATIO
    expect(judgeLanding(pr * 0.99, 0, 0, 0, r).verdict).toBe('perfect')
    expect(judgeLanding(pr * 1.01, 0, 0, 0, r).verdict).toBe('ok')
    expect(judgeLanding(r * 1.01, 0, 0, 0, r).verdict).toBe('miss')
  })
})
