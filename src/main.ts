import { createStage } from './engine/canvas'
import { startLoop } from './engine/loop'
import { DEBUG, drawDebug } from './render/debug'
import { clearWorld } from './render/scene'
import { drawDebugWorld, drawWorld } from './render/world'
import { createWorld, press, release, update, type World } from './game/world'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const stage = createStage(canvas)

let world: World = createWorld()

const onDown = (e: Event): void => {
  e.preventDefault()
  press(world)
}
const onUp = (e: Event): void => {
  e.preventDefault()
  release(world)
}

canvas.addEventListener('pointerdown', onDown)
window.addEventListener('pointerup', onUp)
window.addEventListener('pointercancel', onUp)
// 데스크톱에서 손맛을 보려면 스페이스가 편하다. 입력 자체는 하나다.
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault()
    press(world)
  }
})
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    e.preventDefault()
    release(world)
  }
})

startLoop(
  (dt) => update(world, dt),
  (_alpha, stats) => {
    stage.begin()
    const { ctx } = stage
    clearWorld(ctx)
    drawWorld(ctx, world)
    if (DEBUG) {
      drawDebugWorld(ctx, world)
      drawDebug(
        ctx,
        stats,
        `${world.phase} · ch ${world.charge.toFixed(2)} · 그루터기 ${world.score.stumps} · 콤보 ${world.score.combo}`,
      )
    }
    stage.end()
  },
)

if (DEBUG) {
  ;(window as unknown as { __world: () => World }).__world = () => world
}
