import {
  EASY_COUNT,
  MAX_DIST,
  MIN_DIST,
  RAMP_COUNT,
  SMALL_RADIUS_CHANCE,
  START_MAX_DIST,
  START_MIN_DIST,
  STUMP_HEIGHTS,
  STUMP_RADII,
} from '../config'
import type { Rng } from '../engine/rng'
import { clamp01, mix } from '../engine/ease'
import type { Dir, Stump } from './types'

/** 0(초반) → 1(최대). 초반 EASY_COUNT 개는 0 으로 고정한다. */
export function difficulty(count: number): number {
  if (count <= EASY_COUNT) return 0
  return clamp01((count - EASY_COUNT) / (RAMP_COUNT - EASY_COUNT))
}

/**
 * 다음 그루터기는 **모찌가 실제로 서 있는 지점**에서 +x 또는 +y 로 놓는다.
 * 그루터기 중심이 아니라 착지 지점을 기준으로 삼기 때문에
 * 필요한 점프 거리가 언제나 차지 가능 범위 안에 들어온다(도달 불가 상황이 없다).
 * 대신 그루터기들이 격자에서 조금씩 어긋나며 흩어지는데, 원작의 모양이 그렇다.
 */
export function spawnNext(
  fromX: number,
  fromY: number,
  rng: Rng,
  count: number,
  index: number,
): Stump {
  const d0 = difficulty(count)
  const lo = mix(START_MIN_DIST, MIN_DIST, d0)
  const hi = mix(START_MAX_DIST, MAX_DIST, d0)
  const dist = rng.range(lo, hi)
  const dir: Dir = rng.chance(0.5) ? 'x' : 'y'

  const small = rng.next() < d0 * SMALL_RADIUS_CHANCE
  const r = small
    ? rng.chance(d0)
      ? STUMP_RADII[2]!
      : STUMP_RADII[1]!
    : STUMP_RADII[0]!

  return {
    wx: fromX + (dir === 'x' ? dist : 0),
    wy: fromY + (dir === 'y' ? dist : 0),
    r,
    h: rng.chance(0.4) ? STUMP_HEIGHTS[1]! : STUMP_HEIGHTS[0]!,
    index,
  }
}
