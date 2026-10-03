import { FIXED_DT, MAX_FRAME_DT } from '../config'

export interface LoopStats {
  /** 최근 1초 평균 fps. */
  fps: number
  /** 최근 프레임의 rAF 간격(ms). */
  frameMs: number
  /** 이번 프레임에 돌린 고정 스텝 수. */
  steps: number
}

/**
 * 고정 타임스텝 루프. 물리는 항상 FIXED_DT 로만 전진하고,
 * 렌더는 남은 누산값 비율(alpha)을 받아 보간한다.
 */
export function startLoop(
  update: (dt: number) => void,
  render: (alpha: number, stats: LoopStats) => void,
): () => void {
  let acc = 0
  let prev = performance.now()
  let raf = 0
  let running = true

  const stats: LoopStats = { fps: 0, frameMs: 0, steps: 0 }
  let frames = 0
  let fpsClock = prev

  const tick = (now: number): void => {
    if (!running) return
    raf = requestAnimationFrame(tick)

    const rawDt = (now - prev) / 1000
    prev = now
    stats.frameMs = rawDt * 1000

    acc += Math.min(rawDt, MAX_FRAME_DT)
    let steps = 0
    while (acc >= FIXED_DT) {
      update(FIXED_DT)
      acc -= FIXED_DT
      steps++
    }
    stats.steps = steps

    frames++
    if (now - fpsClock >= 500) {
      stats.fps = (frames * 1000) / (now - fpsClock)
      frames = 0
      fpsClock = now
    }

    render(acc / FIXED_DT, stats)
  }

  raf = requestAnimationFrame(tick)

  return () => {
    running = false
    cancelAnimationFrame(raf)
  }
}
