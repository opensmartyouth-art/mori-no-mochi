import {
  CAM_LERP,
  CAM_LERP_AIR,
  CHARGE_TIME,
  CHARGE_WOBBLE_AMP,
  CHARGE_WOBBLE_HZ,
  FALL_GRAVITY,
  FALL_SLIDE,
  FALL_TIME,
  FLIGHT_STRETCH,
  FLIGHT_STRETCH_BASE,
  LABEL_TIME,
  LAND_RECOVER,
  LAND_SQUASH,
  MAX_DIST,
  MIN_DIST,
  RING_TIME,
  SQUASH_MAX,
  STUMP_HEIGHTS,
  STUMP_RADII,
} from '../config'
import { clamp01, easeOutCubic } from '../engine/ease'
import { createRng, type Rng } from '../engine/rng'
import { createCamera, stumpFocus, updateCamera, type Camera } from './camera'
import { chargeToDistance, planJump, samplePos, velocityZ, type JumpPlan } from './jump'
import { judgeLanding } from './judge'
import { applyLanding, createScore, type ScoreState } from './score'
import { spawnNext } from './spawn'
import type { Judgement, Stump } from './types'

export type Phase = 'idle' | 'charging' | 'flying' | 'falling' | 'over'

export interface Ring {
  wx: number
  wy: number
  wz: number
  /** 시작 반지름(월드 unit). */
  r: number
  t: number
}

export interface MochiState {
  wx: number
  wy: number
  wz: number
  /** 가로/세로 스케일. 1 이 기본. */
  sx: number
  sy: number
}

export interface World {
  rng: Rng
  stumps: Stump[]
  /** 지금 서 있는 그루터기의 stumps 내 위치. */
  curIdx: number
  phase: Phase
  charge: number
  plan: JumpPlan | null
  /** 비행 경과(초). */
  tau: number
  mochi: MochiState
  landT: number
  lastVerdict: Judgement | null
  score: ScoreState
  camera: Camera
  rings: Ring[]
  label: { combo: number; t: number } | null
  overT: number
  clock: number
  /** 낙하 중 속도(unit/s). 실패했을 때만 쓴다. */
  fall: { vx: number; vy: number; vz: number }
}

export function createWorld(seed = (Math.random() * 1e9) | 0): World {
  const rng = createRng(seed)
  const first: Stump = {
    wx: 0,
    wy: 0,
    r: STUMP_RADII[0]!,
    h: STUMP_HEIGHTS[0]!,
    index: 0,
  }
  const second = spawnNext(first.wx, first.wy, rng, 0, 1)
  return {
    rng,
    stumps: [first, second],
    curIdx: 0,
    phase: 'idle',
    charge: 0,
    plan: null,
    tau: 0,
    mochi: { wx: first.wx, wy: first.wy, wz: first.h, sx: 1, sy: 1 },
    landT: LAND_RECOVER,
    lastVerdict: null,
    score: createScore(),
    camera: createCamera(first),
    rings: [],
    label: null,
    overT: 0,
    clock: 0,
    fall: { vx: 0, vy: 0, vz: 0 },
  }
}

export const current = (w: World): Stump => w.stumps[w.curIdx]!
export const target = (w: World): Stump | undefined => w.stumps[w.curIdx + 1]

export function press(w: World): void {
  if (w.phase !== 'idle' || !target(w)) return
  w.phase = 'charging'
  w.charge = 0
}

export function release(w: World): void {
  if (w.phase !== 'charging') return
  const tgt = target(w)
  if (!tgt) {
    w.phase = 'idle'
    return
  }
  const m = w.mochi
  // 다음 그루터기는 모찌가 선 지점에서 축 방향으로 놓였으므로 방향은 축과 같다.
  const dir = Math.abs(tgt.wx - m.wx) > Math.abs(tgt.wy - m.wy) ? 'x' : 'y'
  const dist = chargeToDistance(w.charge, MIN_DIST, MAX_DIST)
  w.plan = planJump(m.wx, m.wy, m.wz, dir, dist, tgt.h)
  w.tau = 0
  w.phase = 'flying'
  w.charge = 0
}

function land(w: World): void {
  const p = w.plan!
  const tgt = target(w)!
  const pos = samplePos(p, p.airTime)
  const res = judgeLanding(pos.wx, pos.wy, tgt.wx, tgt.wy, tgt.r)
  w.lastVerdict = res.verdict

  if (res.verdict === 'miss') {
    // 모서리를 스치고 미끄러지듯 떨어진다. 점프 포물선을 그대로 이어가면
    // 원래 중력이 너무 세서 순식간에 사라진다 — 낙하는 별도 중력으로 돈다.
    const vh = p.dist / p.airTime
    w.mochi.wx = pos.wx
    w.mochi.wy = pos.wy
    w.mochi.wz = tgt.h
    w.fall = {
      vx: (p.dir === 'x' ? vh : 0) * FALL_SLIDE,
      vy: (p.dir === 'y' ? vh : 0) * FALL_SLIDE,
      vz: 0,
    }
    w.phase = 'falling'
    w.overT = 0
    return
  }

  w.mochi.wx = pos.wx
  w.mochi.wy = pos.wy
  w.mochi.wz = tgt.h
  w.curIdx += 1
  w.score = applyLanding(w.score, res.verdict)
  w.landT = 0
  w.phase = 'idle'

  if (res.verdict === 'perfect') {
    w.rings.push({ wx: tgt.wx, wy: tgt.wy, wz: tgt.h, r: tgt.r * 0.55, t: 0 })
    w.label = { combo: w.score.combo, t: 0 }
  } else {
    w.label = null
  }

  // 다음 그루터기를 착지 지점 기준으로 하나 더 만들어 둔다.
  w.stumps.push(
    spawnNext(pos.wx, pos.wy, w.rng, w.score.stumps, w.stumps.length),
  )
}

function updateVisual(w: World, dt: number): void {
  const m = w.mochi
  w.landT += dt
  const recover = easeOutCubic(clamp01(w.landT / LAND_RECOVER))
  const landSy = 1 - LAND_SQUASH * (1 - recover)

  if (w.phase === 'charging') {
    let sy = 1 - SQUASH_MAX * w.charge
    if (w.charge >= 1) {
      sy += Math.sin(w.clock * CHARGE_WOBBLE_HZ * Math.PI * 2) * CHARGE_WOBBLE_AMP
    }
    // 착지 회복 중에 바로 누르면 더 눌린 쪽을 쓴다. 튀지 않게.
    m.sy = Math.min(sy, landSy)
    m.sx = 1 + (1 - m.sy) * 0.6
    return
  }

  if (w.phase === 'flying') {
    const p = w.plan!
    const k = clamp01(Math.abs(velocityZ(p, w.tau)) / Math.max(1e-3, p.vz0))
    m.sy = 1 + FLIGHT_STRETCH_BASE + FLIGHT_STRETCH * k
    m.sx = 1 - (m.sy - 1) * 0.5
    return
  }

  if (w.phase === 'falling') {
    const k = clamp01(Math.abs(w.fall.vz) / 6)
    m.sy = 1 + FLIGHT_STRETCH_BASE + FLIGHT_STRETCH * k
    m.sx = 1 - (m.sy - 1) * 0.5
    return
  }

  m.sy = landSy
  m.sx = 1 + (1 - landSy) * 0.6
}

function updateEffects(w: World, dt: number): void {
  for (let i = w.rings.length - 1; i >= 0; i--) {
    const r = w.rings[i]!
    r.t += dt
    if (r.t >= RING_TIME) w.rings.splice(i, 1)
  }
  if (w.label) {
    w.label.t += dt
    if (w.label.t >= LABEL_TIME) w.label = null
  }
}

export function update(w: World, dt: number): void {
  w.clock += dt

  switch (w.phase) {
    case 'charging':
      w.charge = Math.min(1, w.charge + dt / CHARGE_TIME)
      break

    case 'flying': {
      w.tau += dt
      const p = w.plan!
      if (w.tau >= p.airTime) {
        w.tau = p.airTime
        land(w)
      } else {
        const pos = samplePos(p, w.tau)
        w.mochi.wx = pos.wx
        w.mochi.wy = pos.wy
        w.mochi.wz = pos.wz
      }
      break
    }

    case 'falling': {
      w.overT += dt
      const f = w.fall
      f.vz -= FALL_GRAVITY * dt
      w.mochi.wx += f.vx * dt
      w.mochi.wy += f.vy * dt
      w.mochi.wz += f.vz * dt
      if (w.overT >= FALL_TIME) w.phase = 'over'
      break
    }

    default:
      break
  }

  updateVisual(w, dt)
  updateEffects(w, dt)

  // 점프 중에는 떠난 그루터기를 계속 보고 있으므로 카메라가 거의 멈춘다.
  // 착지해서 curIdx 가 바뀌는 순간부터 새 위치로 부드럽게 미끄러진다(GDD §9).
  // 실패하면 떨어지는 모찌를 잠깐 따라간다(GDD §6). 너무 멀리까지 쫓지는 않는다.
  const focus =
    w.phase === 'falling' || w.phase === 'over'
      ? { wx: w.mochi.wx, wy: w.mochi.wy, wz: Math.max(w.mochi.wz, -2.2) }
      : stumpFocus(current(w))
  updateCamera(
    w.camera,
    focus,
    w.phase === 'flying' ? CAM_LERP_AIR : CAM_LERP,
    dt,
  )
}
