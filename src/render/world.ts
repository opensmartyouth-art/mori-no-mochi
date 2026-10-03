import {
  DUST_TIME,
  MOCHI_RX,
  MOCHI_RY,
  RING_MAX_SCALE,
  RING_TIME,
} from '../config'
import { clamp, clamp01, easeOutCubic, easeOutQuart, mix } from '../engine/ease'
import { depth, isoEllipse, project } from '../game/iso'
import type { Dust, Ring, Snapshot, World } from '../game/world'
import { current, shakeOffset } from '../game/world'
import { drawMochi as paintMochi, stumpShadowGeom } from './scene'
import { blitShadow, blitStump, stumpSprite, STUMP_VARIANTS } from './sprites'

const TAU = Math.PI * 2

function drawRing(ctx: CanvasRenderingContext2D, r: Ring): void {
  const t = clamp01(r.t / RING_TIME)
  const grow = easeOutQuart(t)
  const scale = mix(1, RING_MAX_SCALE, grow)
  const alpha = (1 - easeOutCubic(t)) * 0.95
  const e = isoEllipse(r.r * scale)
  const p = project(r.wx, r.wy, r.wz)
  ctx.save()
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`
  ctx.lineWidth = mix(6, 1.6, grow)
  ctx.beginPath()
  ctx.ellipse(p.x, p.y, e.x, e.y, 0, 0, TAU)
  ctx.stroke()
  ctx.restore()
}

/**
 * 착지 알갱이. 원작을 확대해 보면 뿌연 먼지가 아니라
 * 흰 알갱이 몇 개가 또렷하게 튄다. 떡고물 같은 질감이다.
 */
function drawDust(ctx: CanvasRenderingContext2D, d: Dust): void {
  const t = clamp01(d.t / DUST_TIME)
  const out = easeOutQuart(t)
  const alpha = (1 - easeOutCubic(t)) * 0.95
  // 튀어 올랐다 떨어진다
  const hop = Math.sin(Math.PI * Math.min(1, t * 1.25)) * 0.16
  const p = project(
    d.wx + d.dx * d.reach * out,
    d.wy + d.dy * d.reach * out,
    d.wz + hop,
  )
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#fbf7ec'
  ctx.beginPath()
  ctx.arc(p.x, p.y, mix(2.2, 1.1, t), 0, TAU)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawMochi(
  ctx: CanvasRenderingContext2D,
  w: World,
  v: Snapshot,
): void {
  const p = project(v.mx, v.my, v.mz)
  const rx = MOCHI_RX * v.sx
  const ry = MOCHI_RY * v.sy

  // 점프 직전 다음 그루터기 쪽을 본다(GDD §4).
  const tgt = w.stumps[w.curIdx + 1]
  const look = tgt
    ? clamp((project(tgt.wx, tgt.wy, tgt.h).x - p.x) / 40, -1, 1)
    : 0

  // 발밑 그림자. 공중에서는 지면으로 떨어뜨리고 높이만큼 옅고 작게.
  const standZ = w.phase === 'flying' || w.phase === 'falling' ? 0 : v.mz
  const lift = Math.max(0, v.mz - standZ)
  const ground = project(v.mx, v.my, standZ)
  const k = clamp01(1 - lift / 2.2)
  blitShadow(
    ctx,
    ground.x + 4,
    ground.y + 2,
    MOCHI_RX * 1.15 * mix(0.6, 1, k),
    MOCHI_RY * 0.42 * mix(0.6, 1, k),
    0.3 * mix(0.35, 1, k),
  )

  paintMochi(ctx, { x: p.x, y: p.y, rx, ry, look })
}

type Item =
  | { d: number; kind: 'stump'; i: number }
  | { d: number; kind: 'mochi' }

/** 먼 것부터 그린다. 모찌는 같은 깊이의 그루터기보다 아주 조금 앞. */
export function drawWorld(
  ctx: CanvasRenderingContext2D,
  w: World,
  v: Snapshot,
): void {
  const sh = shakeOffset(w)
  ctx.save()
  ctx.translate(v.camX + sh.x, v.camY + sh.y)

  const items: Item[] = w.stumps.map((s, i) => ({
    d: depth(s.wx, s.wy),
    kind: 'stump' as const,
    i,
  }))
  // 서 있을 때는 자기 그루터기 깊이를 쓴다. 중심을 조금 지나쳐 착지하면
  // 모찌의 평면 깊이가 그루터기보다 커져서 그루터기 뒤로 그려져 버린다.
  const airborne = w.phase === 'flying' || w.phase === 'falling'
  const cur = current(w)
  const mochiDepth = airborne ? depth(v.mx, v.my) : depth(cur.wx, cur.wy)
  items.push({ d: mochiDepth - 1e-3, kind: 'mochi' })
  items.sort((a, b) => b.d - a.d)

  for (const it of items) {
    if (it.kind === 'stump') {
      const s = w.stumps[it.i]!
      const top = project(s.wx, s.wy, s.h)
      const g = stumpShadowGeom(s.r, s.h)
      blitShadow(ctx, top.x + g.dx, top.y + g.dy, g.rx, g.ry, 0.28)
      blitStump(
        ctx,
        stumpSprite(s.r, s.h, ((s.index % STUMP_VARIANTS) + STUMP_VARIANTS) % STUMP_VARIANTS),
        top.x,
        top.y,
      )
    } else {
      drawMochi(ctx, w, v)
    }
  }

  for (const d of w.dust) drawDust(ctx, d)
  for (const r of w.rings) drawRing(ctx, r)

  ctx.restore()
}

/** 디버그용: 지금 노리는 그루터기의 퍼펙트 반경을 그린다. */
export function drawDebugWorld(
  ctx: CanvasRenderingContext2D,
  w: World,
  v: Snapshot,
): void {
  const tgt = w.stumps[w.curIdx + 1]
  if (!tgt) return
  const sh = shakeOffset(w)
  ctx.save()
  ctx.translate(v.camX + sh.x, v.camY + sh.y)
  const p = project(tgt.wx, tgt.wy, tgt.h)
  const e = isoEllipse(tgt.r * 0.28)
  ctx.strokeStyle = 'rgba(120, 255, 140, 0.9)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(p.x, p.y, e.x, e.y, 0, 0, TAU)
  ctx.stroke()
  const c = project(current(w).wx, current(w).wy, current(w).h)
  ctx.strokeStyle = 'rgba(255, 220, 120, 0.5)'
  ctx.beginPath()
  ctx.moveTo(c.x, c.y)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
  ctx.restore()
}

