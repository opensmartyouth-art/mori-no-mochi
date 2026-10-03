import { describe, expect, it } from 'vitest'
import {
  CHARGE_TIME,
  MAX_DIST,
  MIN_DIST,
  PERFECT_R_RATIO,
  STUMP_RADII,
} from '../src/config'

/**
 * 손맛 가드.
 *
 * 차지는 시간에 선형이므로, 판정 창의 크기는 그대로 "누르고 있어야 하는
 * 시간의 폭"이 된다. 창이 몇 ms 인지가 곧 난이도다.
 *
 *   창(ms) = (판정 지름 / 차지 거리 범위) × CHARGE_TIME × 1000
 *
 * config 를 만지다가 퍼펙트가 사람이 맞출 수 없는 값이 되거나 반대로
 * 아무렇게나 눌러도 나오는 값이 되면 여기서 걸린다.
 */
const windowMs = (diameter: number): number =>
  (diameter / (MAX_DIST - MIN_DIST)) * CHARGE_TIME * 1000

const perfectWindow = (r: number): number => windowMs(2 * r * PERFECT_R_RATIO)
const landWindow = (r: number): number => windowMs(2 * r)

describe('판정 창이 사람 손에 맞는 크기인가', () => {
  it('퍼펙트 창 — 가장 큰 그루터기에서도 너무 좁지 않고, 너무 넓지도 않다', () => {
    const big = perfectWindow(STUMP_RADII[0]!)
    // 사람의 뗌 타이밍 오차가 대략 ±50~70ms 다. 그보다 좁으면 운에 가깝다.
    expect(big).toBeGreaterThan(110)
    // 반대로 너무 넓으면 아무렇게나 눌러도 퍼펙트가 나서 의미가 없다.
    expect(big).toBeLessThan(260)
  })

  it('퍼펙트 창 — 가장 작은 그루터기도 가능은 해야 한다', () => {
    expect(perfectWindow(STUMP_RADII[2]!)).toBeGreaterThan(80)
  })

  it('착지 창은 퍼펙트 창보다 충분히 넓다', () => {
    for (const r of STUMP_RADII) {
      expect(landWindow(r!)).toBeGreaterThan(perfectWindow(r!) * 2.5)
    }
    // 가장 작은 그루터기도 한참 여유가 있어야 평범한 점프가 성립한다
    expect(landWindow(STUMP_RADII[2]!)).toBeGreaterThan(280)
  })

  it('난이도는 반지름이 줄면서만 올라간다 — 창이 뒤집히지 않는다', () => {
    const ws = STUMP_RADII.map((r) => perfectWindow(r!))
    for (let i = 1; i < ws.length; i++) {
      expect(ws[i]!).toBeLessThan(ws[i - 1]!)
    }
  })
})
