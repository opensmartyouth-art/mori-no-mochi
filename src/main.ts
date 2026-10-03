import { createStage } from './engine/canvas'
import { startLoop } from './engine/loop'
import { DEBUG, drawDebug } from './render/debug'
import { drawGround, drawVignette } from './render/ground'
import { setSpriteScale } from './render/sprites'
import { drawDebugWorld, drawWorld } from './render/world'
import { drawHud } from './render/hud'
import { drawResult, hitButton } from './render/result'
import { totalScore } from './game/score'
import { submit } from './game/session'
import { createWorld, press, release, update, type World } from './game/world'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const stage = createStage(canvas)

let world: World = createWorld()
let submitted = false

function restart(): void {
  world = createWorld()
  submitted = false
}

function onPress(x: number, y: number): void {
  if (world.phase === 'over') {
    // 카드가 자리를 잡기 전에 눌러서 날려버리지 않게 잠깐 막는다.
    if (world.overT > 0.45 && hitButton(x, y)) restart()
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
window.addEventListener('pointercancel', () => release(world))

// 데스크톱에서 손맛을 보려면 스페이스가 편하다. 입력 자체는 똑같이 하나다.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat) return
  e.preventDefault()
  if (world.phase === 'over') {
    if (world.overT > 0.45) restart()
    return
  }
  press(world)
})
window.addEventListener('keyup', (e) => {
  if (e.code !== 'Space') return
  e.preventDefault()
  release(world)
})

startLoop(
  (dt) => {
    update(world, dt)
    if (world.phase === 'over' && !submitted) {
      submitted = true
      submit(world.score.stumps, world.score.bestCombo, totalScore(world.score))
    }
  },
  (_alpha, stats) => {
    stage.begin()
    setSpriteScale(stage.scale)
    const { ctx } = stage
    drawGround(ctx, world.camera.px, world.camera.py)
    drawWorld(ctx, world)
    drawVignette(ctx)
    if (DEBUG) drawDebugWorld(ctx, world)
    if (world.phase === 'over') drawResult(ctx, world, world.overT)
    else drawHud(ctx, world)
    if (DEBUG) {
      drawDebug(
        ctx,
        stats,
        `${world.phase} · ch ${world.charge.toFixed(2)} · 그루터기 ${world.score.stumps} · 콤보 ${world.score.combo} · 점수 ${totalScore(world.score)}`,
      )
    }
    stage.end()
  },
)

if (DEBUG) {
  ;(window as unknown as { __world: () => World }).__world = () => world
}
