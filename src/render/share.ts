import { DESIGN_H, DESIGN_W, FONT_STACK } from '../config'
import { drawGround } from './ground'
import { drawResult } from './result'
import type { World } from '../game/world'

/**
 * 결과를 이미지 한 장으로 만들어 공유한다(GDD §11 2차).
 * 공유 시트를 지원하면 시트로, 아니면 파일로 내려받는다.
 * 앱인토스 SDK 는 범위 밖이라 브라우저 표준만 쓴다.
 */
export async function shareResult(w: World): Promise<void> {
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = DESIGN_W * scale
  canvas.height = DESIGN_H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(scale, scale)

  drawGround(ctx, 120, 60)
  drawResult(ctx, w, 1)

  ctx.textAlign = 'center'
  ctx.font = `700 11px ${FONT_STACK}`
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillText('MORI NO MOCHI · 숲속의 모찌', DESIGN_W / 2, DESIGN_H - 48)

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob((b) => res(b), 'image/png'),
  )
  if (!blob) return

  const file = new File([blob], 'mori-no-mochi.png', { type: 'image/png' })
  const nav = navigator as Navigator & {
    canShare?: (d: ShareData) => boolean
  }
  const text = `숲속의 모찌 — 그루터기 ${w.score.stumps}개`

  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return
    } catch {
      // 사용자가 취소했거나 공유 시트가 거부했다. 내려받기로 넘어간다.
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mori-no-mochi.png'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
