import { createStage } from './engine/canvas'
import { startLoop } from './engine/loop'
import { DEBUG, TIME_SCALE, drawDebug } from './render/debug'
import { drawGround, drawVignette } from './render/ground'
import { setSpriteScale } from './render/sprites'
import { drawDebugWorld, drawWorld } from './render/world'
import { drawHud, drawRecords } from './render/hud'
import { drawResult, hitButton } from './render/result'
import { drawTitle } from './render/title'
import { shareResult } from './render/share'
import { totalScore } from './game/score'
import { submit } from './game/session'
import {
  cancelCharge,
  createWorld,
  press,
  release,
  shakeOffset,
  update,
  type World,
} from './game/world'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const stage = createStage(canvas)

type Screen = 'title' | 'play'

let world: World = createWorld()
let screen: Screen = 'title'
let screenT = 0
let submitted = false

function toTitle(): void {
  world = createWorld()
  screen = 'title'
  screenT = 0
  submitted = false
}

function restart(): void {
  world = createWorld()
  screen = 'play'
  screenT = 0
  submitted = false
}

function onPress(x: number, y: number): void {
  if (screen === 'title') {
    // 타이틀에서 누르는 그 입력이 그대로 첫 차지가 된다.
    screen = 'play'
    screenT = 0
    press(world)
    return
  }
  if (world.phase === 'over') {
    // 카드가 자리를 잡기 전에 눌러서 날려버리지 않게 잠깐 막는다.
    if (world.overT <= 0.45) return
    const b = hitButton(x, y)
    if (!b) return
    if (b.id === 'retry') restart()
    else if (b.id === 'home') toTitle()
    else void shareResult(world)
    return
  }
  press(world)
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault()
  const p = stage.toDesign(e.clientX, e.clientY)
  onPress(p.x, p.y)
})
window.addEventListener('pointerup', (e) => {
  e.preventDefault()
  release(world)
})
// 포인터가 중간에 빼앗기거나(스크롤 제스처, 전화) 창이 포커스를 잃으면
// 점프시키지 않고 차지만 버린다. 돌아와서 떼는 순간 최대 점프가 나가면 안 된다.
window.addEventListener('pointercancel', () => cancelCharge(world))
window.addEventListener('blur', () => cancelCharge(world))
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') cancelCharge(world)
})

// 데스크톱에서 손맛을 보려면 스페이스가 편하다. 입력 자체는 똑같이 하나다.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat) return
  e.preventDefault()
  if (screen === 'play' && world.phase === 'over') {
    if (world.overT > 0.45) restart()
    return
  }
  onPress(0, 0)
})
window.addEventListener('keyup', (e) => {
  if (e.code !== 'Space') return
  e.preventDefault()
  release(world)
})

startLoop(
  (raw) => {
    const dt = raw * TIME_SCALE
    screenT += dt
    update(world, dt)
    if (screen === 'play' && world.phase === 'over' && !submitted) {
      submitted = true
      submit(world.score.stumps, world.score.bestCombo, totalScore(world.score))
    }
  },
  (_alpha, stats) => {
    stage.begin()
    setSpriteScale(stage.scale)
    const { ctx } = stage

    const sh = shakeOffset(world)
    // 바닥은 레터박스까지 칠한다. 비율이 다른 창에서 경계가 보이면 안 된다.
    drawGround(ctx, world.camera.px + sh.x, world.camera.py + sh.y, stage.bleed)
    stage.clipDesign()
    drawWorld(ctx, world)
    if (DEBUG) drawDebugWorld(ctx, world)
    stage.unclip()
    drawVignette(ctx, stage.bleed)

    if (screen === 'title') {
      drawRecords(ctx)
      drawTitle(ctx, screenT)
    }
    else if (world.phase === 'over') drawResult(ctx, world, world.overT)
    else drawHud(ctx, world)

    if (DEBUG) {
      drawDebug(
        ctx,
        stats,
        `${screen}/${world.phase} · ch ${world.charge.toFixed(2)} · 그루터기 ${world.score.stumps} · 콤보 ${world.score.combo} · 점수 ${totalScore(world.score)}`,
      )
    }
    stage.end()
  },
)

if (DEBUG) {
  ;(window as unknown as { __world: () => World }).__world = () => world
}
