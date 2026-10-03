import { createStage } from './engine/canvas'
import { startLoop } from './engine/loop'
import { createRng } from './engine/rng'
import { DEBUG, drawDebug } from './render/debug'
import { clearWorld, drawStump, drawStumpShadow } from './render/scene'
import { createCamera, updateCamera } from './game/camera'
import { depth } from './game/iso'
import { CAM_LERP, STUMP_HEIGHTS, STUMP_RADII } from './config'
import type { Dir, Stump } from './game/types'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const stage = createStage(canvas)

// 2단계: 더미 그루터기 5개를 올바른 깊이 순서로 그린다.
const rng = createRng(7)
const stumps: Stump[] = [
  { wx: 0, wy: 0, r: STUMP_RADII[0]!, h: STUMP_HEIGHTS[0]!, index: 0 },
]
for (let i = 1; i < 5; i++) {
  const prev = stumps[i - 1]!
  // 두 갈래(+x 우상향 / +y 좌상향)가 다 보이도록 지그재그로 고정한다.
  const dir: Dir = i % 2 === 1 ? 'x' : 'y'
  const d = rng.range(2.4, 3.4)
  stumps.push({
    wx: prev.wx + (dir === 'x' ? d : 0),
    wy: prev.wy + (dir === 'y' ? d : 0),
    r: rng.pick(STUMP_RADII),
    h: rng.pick(STUMP_HEIGHTS),
    index: i,
  })
}

const camera = createCamera(stumps[0]!)
let focusIndex = 0
let clock = 0

startLoop(
  (dt) => {
    clock += dt
    // 깊이 순서를 눈으로 확인하려고 포커스를 천천히 옮긴다.
    focusIndex = Math.floor(clock / 1.6) % stumps.length
    updateCamera(camera, stumps[focusIndex]!, CAM_LERP, dt)
  },
  (_alpha, stats) => {
    stage.begin()
    const { ctx } = stage
    clearWorld(ctx)

    ctx.save()
    ctx.translate(camera.px, camera.py)
    const sorted = [...stumps].sort(
      (a, b) => depth(b.wx, b.wy) - depth(a.wx, a.wy),
    )
    // 그림자는 자기 그루터기 직전에 그린다. 그래야 가까운 것이 먼 것의
    // 그림자를 덮어 레이어가 뒤집히지 않는다.
    for (const s of sorted) {
      drawStumpShadow(ctx, s)
      drawStump(ctx, s)
    }
    ctx.restore()

    drawDebug(ctx, stats, DEBUG ? `focus ${focusIndex}` : '')
    stage.end()
  },
)
