import {
  EASY_COUNT,
  GEN_MAX_DIST,
  GEN_MIN_DIST,
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
 * 다음 그루터기는 **직전 그루터기 중심**에서 +x(우상향) 또는 +y(좌상향)로 놓는다.
 * 모찌의 착지 지점이 아니라 중심을 기준으로 삼아야 앞쪽 여러 개를 미리 만들어 둘 수 있다.
 * 착지 오차만큼 실제 필요 거리가 달라지는데, 그 폭은 config 의 차지 범위가 덮는다.
 */
export function spawnNext(
  fromX: number,
  fromY: number,
  rng: Rng,
  index: number,
): Stump {
  const d0 = difficulty(index)
  const lo = mix(START_MIN_DIST, GEN_MIN_DIST, d0)
  const hi = mix(START_MAX_DIST, GEN_MAX_DIST, d0)
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
