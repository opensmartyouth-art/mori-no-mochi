import { AIR_PER_DIST, BASE_AIR, GRAVITY } from '../config'

/** 점프 한 번의 확정된 계획. 순수 데이터 — 렌더를 모른다. */
export interface JumpPlan {
  fromX: number
  fromY: number
  fromZ: number
  /** 수평 진행 방향(단위벡터). 모찌가 선 지점에서 목표 중심을 향한다. */
  dirX: number
  dirY: number
  /** 수평 이동 거리(unit). */
  dist: number
  /** 체공시간(초). */
  airTime: number
  /** 초기 수직속도(unit/s). */
  vz0: number
}

/** 차지 t(0~1) → 수평거리. 1차는 선형(GDD §3). */
export const chargeToDistance = (
  t: number,
  minDist: number,
  maxDist: number,
): number => minDist + t * (maxDist - minDist)

export const airTimeFor = (dist: number): number =>
  BASE_AIR + dist * AIR_PER_DIST

/**
 * 착지 시각에 정확히 목표 높이 z1 에 닿도록 초기 수직속도를 역산한다.
 * z(T) = z0 + vz0·T − ½·g·T²  =  z1
 */
export const initialVz = (
  z0: number,
  z1: number,
  T: number,
  g: number = GRAVITY,
): number => (z1 - z0 + 0.5 * g * T * T) / T

export function planJump(
  fromX: number,
  fromY: number,
  fromZ: number,
  dirX: number,
  dirY: number,
  dist: number,
  targetZ: number,
): JumpPlan {
  const airTime = airTimeFor(dist)
  return {
    fromX,
    fromY,
    fromZ,
    dirX,
    dirY,
    dist,
    airTime,
    vz0: initialVz(fromZ, targetZ, airTime),
  }
}

export interface Pos3 {
  wx: number
  wy: number
  wz: number
}

/** 수평 등속, 수직 포물선. tau 는 airTime 을 넘어도 계속 유효하다(낙하). */
export function samplePos(p: JumpPlan, tau: number): Pos3 {
  const travel = (p.dist * tau) / p.airTime
  return {
    wx: p.fromX + p.dirX * travel,
    wy: p.fromY + p.dirY * travel,
    wz: p.fromZ + p.vz0 * tau - 0.5 * GRAVITY * tau * tau,
  }
}

/** 현재 수직속도. 스트레치 양을 정하는 데 쓴다. */
export const velocityZ = (p: JumpPlan, tau: number): number =>
  p.vz0 - GRAVITY * tau
