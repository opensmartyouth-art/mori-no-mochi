import { DESIGN_H, DESIGN_W, COL_BG } from '../config'

/**
 * 디자인 공간(DESIGN_W x DESIGN_H)을 뷰포트에 contain 으로 맞추고 가운데 정렬한다.
 * 비율이 다른 창에서는 레터박스가 생기는데, 배경색과 같은 색으로 덮어 이음새를 없앤다.
 */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Stage {
  readonly ctx: CanvasRenderingContext2D
  /** 디자인 1px 이 화면 몇 px 인지. */
  readonly scale: number
  /**
   * 레터박스까지 포함한 디자인 좌표 범위.
   * 배경을 여기까지 칠해야 비율이 다른 창에서 경계가 안 보인다.
   */
  readonly bleed: Rect
  /** 프레임 시작: 버퍼 리사이즈 + 클리어 + 디자인 공간으로 변환(클립은 아직). */
  begin(): void
  /** 디자인 영역 바깥으로 월드가 새지 않게 자른다. */
  clipDesign(): void
  /** clipDesign 해제. */
  unclip(): void
  end(): void
  /** 포인터 이벤트 좌표 → 디자인 공간 좌표. */
  toDesign(clientX: number, clientY: number): { x: number; y: number }
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('2d 컨텍스트를 만들 수 없다')

  let scale = 1
  let offX = 0
  let offY = 0
  let bufW = 0
  let bufH = 0
  const bleed: Rect = { x: 0, y: 0, w: DESIGN_W, h: DESIGN_H }

  const resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const cssW = canvas.clientWidth || window.innerWidth
    const cssH = canvas.clientHeight || window.innerHeight
    const w = Math.round(cssW * dpr)
    const h = Math.round(cssH * dpr)
    if (w !== bufW || h !== bufH) {
      canvas.width = w
      canvas.height = h
      bufW = w
      bufH = h
    }
    scale = Math.min(cssW / DESIGN_W, cssH / DESIGN_H) * dpr
    offX = (w - DESIGN_W * scale) / 2
    offY = (h - DESIGN_H * scale) / 2
    bleed.x = -offX / scale
    bleed.y = -offY / scale
    bleed.w = w / scale
    bleed.h = h / scale
  }

  return {
    ctx,
    get scale() {
      return scale
    },
    bleed,
    begin() {
      resize()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = COL_BG
      ctx.fillRect(0, 0, bufW, bufH)
      ctx.save()
      ctx.setTransform(scale, 0, 0, scale, offX, offY)
    },
    clipDesign() {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, DESIGN_W, DESIGN_H)
      ctx.clip()
    },
    unclip() {
      ctx.restore()
    },
    end() {
      ctx.restore()
    },
    toDesign(clientX, clientY) {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      return {
        x: ((clientX - rect.left) * dpr - offX) / scale,
        y: ((clientY - rect.top) * dpr - offY) / scale,
      }
    },
  }
}
