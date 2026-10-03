import { createStage } from './engine/canvas'
import { startLoop } from './engine/loop'
import { DEBUG, drawDebug } from './render/debug'
import { DESIGN_H, DESIGN_W, COL_BG } from './config'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const stage = createStage(canvas)

// 1단계: 빈 루프. 2단계부터 여기에 월드가 들어간다.
let elapsed = 0

startLoop(
  (dt) => {
    elapsed += dt
  },
  (_alpha, stats) => {
    stage.begin()
    const { ctx } = stage
    ctx.fillStyle = COL_BG
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H)
    if (DEBUG) {
      // 루프가 실제로 도는지 눈으로 확인하기 위한 임시 마커.
      ctx.fillStyle = 'rgba(255,255,255,0.22)'
      const x = DESIGN_W / 2 + Math.cos(elapsed * 2) * 90
      const y = DESIGN_H / 2 + Math.sin(elapsed * 2) * 90
      ctx.beginPath()
      ctx.arc(x, y, 14, 0, Math.PI * 2)
      ctx.fill()
    }
    drawDebug(ctx, stats)
    stage.end()
  },
)
