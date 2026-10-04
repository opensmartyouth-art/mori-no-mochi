import {
  CAM_LERP,
  CAM_LERP_AIR,
  CHARGE_TIME,
  CULL_MARGIN,
  DESIGN_H,
  DUST_COUNT,
  DUST_SPREAD,
  DUST_TIME,
  CHARGE_WOBBLE_AMP,
  CHARGE_WOBBLE_HZ,
  FALL_GRAVITY,
  FALL_SLIDE,
  FALL_TIME,
  FLIGHT_STRETCH,
  FLIGHT_STRETCH_BASE,
  KEEP_BEHIND,
  LABEL_TIME,
  LOOKAHEAD,
  LAND_RECOVER,
  LAND_SQUASH,
  MAX_DIST,
  MIN_DIST,
  HINT_TIME,
  RING_TIME,
  SHAKE_MISS,
  SHAKE_OK,
  SHAKE_PERFECT,
  SHAKE_TIME,
  SLIDE_SPEED,
  SQUASH_MAX,
  STUMP_HEIGHTS,
  STUMP_RADII,
} from '../config'
import { clamp01, easeOutCubic, mix } from '../engine/ease'
import { createRng, type Rng } from '../engine/rng'
import { createCamera, stumpFocus, updateCamera, type Camera } from './camera'
import { projectY } from './iso'
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

/**
 * 착지 보정 힌트. 중심이 어디였고 어디에 내렸는지를 그루터기 윗면에 표시한다.
 * 퍼펙트가 아닐 때만 생긴다 — 퍼펙트는 링으로 이미 알려준다.
 */
export interface AimHint {
  /** 중심에서 어긋난 거리(unit). */
  d: number
  /** 그 그루터기의 반지름(unit). 눈금의 폭이 된다. */
  r: number
  /** 중심보다 멀리 갔으면 true. */
  long: boolean
  t: number
}

export interface Dust {
  wx: number
  wy: number
  wz: number
  /** 평면상 퍼지는 방향. */
  dx: number
  dy: number
  reach: number
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
  hint: AimHint | null
  overT: number
  clock: number
  /** 낙하 중 속도(unit/s). 실패했을 때만 쓴다. */
  fall: { vx: number; vy: number; vz: number }
  dust: Dust[]
  shake: { t: number; mag: number }
  /**
   * 모찌가 지금 올라서 있는 그루터기. 서 있을 때와, 실패 후 윗면을
   * 미끄러지는 동안 채워진다. 공중이면 null.
   * 렌더는 이걸로 깊이를 잡는다 — 자기 발판 뒤로 그려지면 안 된다.
   */
  ground: Stump | null
  /** 직전 물리 스텝의 값. 렌더가 두 스텝 사이를 보간한다. */
  prev: Snapshot
}

/** 보간에 필요한 것만. 시각 상태라 판정에는 쓰지 않는다. */
export interface Snapshot {
  mx: number
  my: number
  mz: number
  sx: number
  sy: number
  camX: number
  camY: number
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
  const cam = createCamera(first)
  const stumps: Stump[] = [first]
  for (let i = 1; i <= LOOKAHEAD; i++) {
    const prev = stumps[i - 1]!
    stumps.push(spawnNext(prev.wx, prev.wy, rng, i))
  }
  return {
    rng,
    stumps,
    curIdx: 0,
    phase: 'idle',
    charge: 0,
    plan: null,
    tau: 0,
    mochi: { wx: first.wx, wy: first.wy, wz: first.h, sx: 1, sy: 1 },
    landT: LAND_RECOVER,
    lastVerdict: null,
    score: createScore(),
    camera: cam,
    rings: [],
    label: null,
    hint: null,
    overT: 0,
    clock: 0,
    fall: { vx: 0, vy: 0, vz: 0 },
    dust: [],
    shake: { t: SHAKE_TIME, mag: 0 },
    ground: first,
    prev: {
      mx: first.wx,
      my: first.wy,
      mz: first.h,
      sx: 1,
      sy: 1,
      camX: cam.px,
      camY: cam.py,
    },
  }
}

/**
 * 물리는 60Hz 로 고정이라, 120Hz 화면에서는 같은 상태를 두 번 그리게 된다.
 * 직전 스텝과 현재 스텝 사이를 alpha 로 섞어 그 저더를 없앤다.
 */
export function interpolate(w: World, alpha: number): Snapshot {
  const a = clamp01(alpha)
  const p = w.prev
  const m = w.mochi
  return {
    mx: mix(p.mx, m.wx, a),
    my: mix(p.my, m.wy, a),
    mz: mix(p.mz, m.wz, a),
    sx: mix(p.sx, m.sx, a),
    sy: mix(p.sy, m.sy, a),
    camX: mix(p.camX, w.camera.px, a),
    camY: mix(p.camY, w.camera.py, a),
  }
}

export const current = (w: World): Stump => w.stumps[w.curIdx]!

/** 이 평면 좌표를 윗면 안에 품는 그루터기. 없으면 undefined. */
function stumpUnder(w: World, x: number, y: number): Stump | undefined {
  for (const s of w.stumps) {
    if (Math.hypot(x - s.wx, y - s.wy) <= s.r) return s
  }
  return undefined
}

/** 그루터기 중심에서 바깥으로 향하는 단위벡터. 정중앙이면 진행 방향을 쓴다. */
function outward(
  x: number,
  y: number,
  s: Stump,
  fallbackX: number,
  fallbackY: number,
): { x: number; y: number } {
  const dx = x - s.wx
  const dy = y - s.wy
  const len = Math.hypot(dx, dy)
  if (len < 1e-4) return { x: fallbackX, y: fallbackY }
  return { x: dx / len, y: dy / len }
}
export const target = (w: World): Stump | undefined => w.stumps[w.curIdx + 1]

export function press(w: World): void {
  if (w.phase !== 'idle' || !target(w)) return
  w.phase = 'charging'
  w.charge = 0
}

/**
 * 차지를 점프 없이 되돌린다.
 * 누르고 있는 중에 알림이 뜨거나 앱을 전환하면 pointerup 이 영영 안 올 수 있다.
 * 그 사이 차지는 상한까지 차 있고, 돌아와 손을 떼는 순간 최대 점프가 나가
 * 그대로 죽는다. 그럴 바엔 차지를 버리는 쪽이 낫다.
 */
export function cancelCharge(w: World): void {
  if (w.phase !== 'charging') return
  w.phase = 'idle'
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
  // 모찌가 선 지점에서 목표 중심을 향해 뛴다. 그래서 오차는 항상
  // 넘치거나 모자라는 한 방향뿐이고 옆으로 어긋나 쌓이지 않는다.
  const vx = tgt.wx - m.wx
  const vy = tgt.wy - m.wy
  const len = Math.hypot(vx, vy) || 1
  const dist = chargeToDistance(w.charge, MIN_DIST, MAX_DIST)
  w.plan = planJump(m.wx, m.wy, m.wz, vx / len, vy / len, dist, tgt.h)
  w.tau = 0
  w.phase = 'flying'
  w.charge = 0
  w.ground = null
  w.hint = null
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
    w.mochi.wx = pos.wx
    w.mochi.wy = pos.wy

    // 빗나갔어도 발밑에 그루터기가 있으면 뚫고 지나가면 안 된다.
    // 그 위에 올라섰다가 모서리로 미끄러져 떨어진다(GDD §6).
    const under = stumpUnder(w, pos.wx, pos.wy)
    if (under) {
      const out = outward(pos.wx, pos.wy, under, p.dirX, p.dirY)
      w.mochi.wz = under.h
      w.ground = under
      w.fall = { vx: out.x * SLIDE_SPEED, vy: out.y * SLIDE_SPEED, vz: 0 }
      puff(w, pos.wx, pos.wy, under.h, 0.8)
    } else {
      const vh = (p.dist / p.airTime) * FALL_SLIDE
      w.mochi.wz = tgt.h
      w.ground = null
      w.fall = { vx: p.dirX * vh, vy: p.dirY * vh, vz: 0 }
    }
    kick(w, SHAKE_MISS)
    // 직전 퍼펙트 라벨을 지우지 않으면 눈금과 같은 자리에 겹친다.
    w.label = null
    w.hint = makeHint(w, pos.wx, pos.wy, tgt)
    w.phase = 'falling'
    w.overT = 0
    return
  }

  w.mochi.wx = pos.wx
  w.mochi.wy = pos.wy
  w.mochi.wz = tgt.h
  w.ground = tgt
  w.curIdx += 1
  w.score = applyLanding(w.score, res.verdict)
  w.landT = 0
  w.phase = 'idle'

  puff(w, pos.wx, pos.wy, tgt.h, res.verdict === 'perfect' ? 1.15 : 0.85)

  if (res.verdict === 'perfect') {
    w.rings.push({ wx: tgt.wx, wy: tgt.wy, wz: tgt.h, r: tgt.r * 0.55, t: 0 })
    w.label = { combo: w.score.combo, t: 0 }
    kick(w, SHAKE_PERFECT)
  } else {
    w.label = null
    kick(w, SHAKE_OK)
    w.hint = makeHint(w, pos.wx, pos.wy, tgt)
  }

  // 앞쪽으로 항상 LOOKAHEAD 개가 보이도록 채운다. 직전 그루터기 중심 기준.
  while (w.stumps.length - w.curIdx <= LOOKAHEAD) {
    const last = w.stumps[w.stumps.length - 1]!
    w.stumps.push(spawnNext(last.wx, last.wy, w.rng, last.index + 1))
  }
}

/**
 * 지나간 그루터기 버리기(GDD §8). 진행은 항상 화면 위쪽으로 가므로
 * 배열 앞쪽이 가장 아래에 있다. 화면 아래로 완전히 빠진 것만 떨어낸다.
 */
function cull(w: World): void {
  while (w.curIdx > KEEP_BEHIND) {
    const s = w.stumps[0]!
    const screenY = projectY(s.wx, s.wy, 0) + w.camera.py
    if (screenY < DESIGN_H + CULL_MARGIN) break
    w.stumps.shift()
    w.curIdx -= 1
  }
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

function makeHint(
  w: World,
  lx: number,
  ly: number,
  tgt: Stump,
): AimHint {
  const p = w.plan!
  // 진행 방향으로 투영해 넘쳤는지 모자랐는지 가린다
  const along = (lx - tgt.wx) * p.dirX + (ly - tgt.wy) * p.dirY
  return {
    d: Math.hypot(lx - tgt.wx, ly - tgt.wy),
    r: tgt.r,
    long: along > 0,
    t: 0,
  }
}

function puff(w: World, x: number, y: number, z: number, strength: number): void {
  for (let i = 0; i < DUST_COUNT; i++) {
    const a = w.rng.next() * Math.PI * 2
    w.dust.push({
      wx: x,
      wy: y,
      wz: z,
      dx: Math.cos(a),
      dy: Math.sin(a),
      reach: DUST_SPREAD * strength * w.rng.range(0.6, 1.3),
      t: 0,
    })
  }
}

const kick = (w: World, mag: number): void => {
  w.shake = { t: 0, mag }
}

/** 화면 흔들림 오프셋(px). 착지 직후에만 아주 짧게. */
export function shakeOffset(w: World): { x: number; y: number } {
  const { t, mag } = w.shake
  if (t >= SHAKE_TIME || mag <= 0) return { x: 0, y: 0 }
  const k = 1 - easeOutCubic(t / SHAKE_TIME)
  return {
    x: Math.sin(t * 74) * mag * k,
    y: Math.cos(t * 96) * mag * k * 0.7,
  }
}

function updateEffects(w: World, dt: number): void {
  w.shake.t += dt
  for (let i = w.dust.length - 1; i >= 0; i--) {
    const d = w.dust[i]!
    d.t += dt
    if (d.t >= DUST_TIME) w.dust.splice(i, 1)
  }
  for (let i = w.rings.length - 1; i >= 0; i--) {
    const r = w.rings[i]!
    r.t += dt
    if (r.t >= RING_TIME) w.rings.splice(i, 1)
  }
  if (w.label) {
    w.label.t += dt
    if (w.label.t >= LABEL_TIME) w.label = null
  }
  if (w.hint) {
    w.hint.t += dt
    if (w.hint.t >= HINT_TIME) w.hint = null
  }
}

export function update(w: World, dt: number): void {
  // 이 스텝을 밟기 전 상태를 남겨 둔다. 렌더가 여기서 저기까지를 보간한다.
  const p = w.prev
  p.mx = w.mochi.wx
  p.my = w.mochi.wy
  p.mz = w.mochi.wz
  p.sx = w.mochi.sx
  p.sy = w.mochi.sy
  p.camX = w.camera.px
  p.camY = w.camera.py

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
      const m = w.mochi
      m.wx += f.vx * dt
      m.wy += f.vy * dt

      if (w.ground) {
        // 윗면 위를 미끄러지는 중 — 모서리를 넘어서야 떨어지기 시작한다
        const g = w.ground
        m.wz = g.h
        if (Math.hypot(m.wx - g.wx, m.wy - g.wy) > g.r) w.ground = null
      } else {
        const beforeZ = m.wz
        f.vz -= FALL_GRAVITY * dt
        m.wz += f.vz * dt
        // 떨어지다 다른 그루터기 윗면을 지나면 거기에 걸쳤다가 미끄러진다
        if (f.vz < 0) {
          const s = stumpUnder(w, m.wx, m.wy)
          if (s && beforeZ >= s.h && m.wz < s.h) {
            const out = outward(m.wx, m.wy, s, Math.sign(f.vx) || 1, Math.sign(f.vy) || 0)
            w.ground = s
            m.wz = s.h
            f.vx = out.x * SLIDE_SPEED
            f.vy = out.y * SLIDE_SPEED
            f.vz = 0
            puff(w, m.wx, m.wy, s.h, 0.5)
          }
        }
      }
      if (w.overT >= FALL_TIME) {
        // overT 는 여기서부터 '결과 카드가 뜬 뒤 흐른 시간' 으로 역할이 바뀐다.
        // 리셋하지 않으면 카드가 등장 연출 없이 완성된 채 튀어나오고,
        // main.ts 의 오탭 방지 0.45초 가드도 한 프레임도 작동하지 않는다.
        w.phase = 'over'
        w.overT = 0
      }
      break
    }

    case 'over':
      w.overT += dt
      break

    default:
      break
  }

  updateVisual(w, dt)
  updateEffects(w, dt)
  cull(w)

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
