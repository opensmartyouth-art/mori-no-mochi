import { createStage } from './engine/canvas'
import { startLoop } from './engine/loop'
import { DEBUG, TIME_SCALE, drawDebug } from './render/debug'
import { drawGround, drawVignette } from './render/ground'
import { setSpriteScale } from './render/sprites'
import { drawDebugWorld, drawWorld } from './render/world'
import { drawHud, drawRecords } from './render/hud'
import { drawResult, hitButton } from './render/result'
import { drawOffer, hitOffer } from './render/offer'
import { createRewardedAd } from './platform/ads'
import { drawTitle } from './render/title'
import { shareResult } from './render/share'
import { totalScore } from './game/score'
import { submit } from './game/session'
import {
  cancelCharge,
  createWorld,
  declineContinue,
  revive,
  interpolate,
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

// 광고는 미리 받아 둔다. 떨어진 뒤에 받기 시작하면 기다리게 된다.
const ad = createRewardedAd()
ad.preload()
/** 광고를 불러오거나 재생하는 중. 이 동안은 입력을 막는다. */
let adPending = false

async function watchAdAndContinue(): Promise<void> {
  if (adPending) return
  adPending = true
  try {
    // 보상 조건을 채웠을 때만 되살린다. 중간에 닫으면 결과로 간다.
    const earned = await ad.show()
    if (earned) revive(world)
    else declineContinue(world)
  } catch {
    declineContinue(world)
  } finally {
    adPending = false
    ad.preload()
  }
}

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
    // 화면만 바꾸고 차지는 시작하지 않는다.
    // 시작 탭을 그대로 첫 차지로 쓰면, 톡 치고 마는 짧은 탭(60~120ms)이
    // 차지 거의 0 인 점프가 되어 첫 그루터기(2.3~3.2)에 수학적으로 닿지 못한다.
    // 실측하면 0ms 탭은 100%, 100ms 탭도 절반이 그 자리에서 판이 끝났다.
    // 타이틀 안내가 이미 "꾹 눌렀다가 떼면 점프" 이므로 두 번째 입력부터 차지하는 게 맞다.
    screen = 'play'
    screenT = 0
    return
  }
  if (world.phase === 'offer') {
    if (adPending || world.overT <= 0.35) return
    const b = hitOffer(x, y)
    if (b === 'continue') void watchAdAndContinue()
    else if (b === 'quit') declineContinue(world)
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

/**
 * 차지를 시작한 입력이 누구인지 기억한다.
 *
 * window 의 pointerup 을 무조건 release 로 받으면, 차지 중에 두 번째 손가락을
 * 올렸다 떼는 것만으로 덜 찬 점프가 발사된다. 폰에서는 충분히 일어나는 사고고,
 * 그 한 번으로 판이 끝난다. 차지를 시작한 포인터의 뗌만 받는다.
 */
let owner: { kind: 'pointer'; id: number } | { kind: 'key' } | null = null

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault()
  if (owner) return
  const p = stage.toDesign(e.clientX, e.clientY)
  onPress(p.x, p.y)
  if (world.phase === 'charging') owner = { kind: 'pointer', id: e.pointerId }
})

const endPointer = (e: PointerEvent, cancel: boolean): void => {
  if (owner && (owner.kind !== 'pointer' || owner.id !== e.pointerId)) return
  owner = null
  if (cancel) cancelCharge(world)
  else release(world)
}

window.addEventListener('pointerup', (e) => {
  e.preventDefault()
  endPointer(e, false)
})
// 포인터가 중간에 빼앗기거나(스크롤 제스처, 전화) 창이 포커스를 잃으면
// 점프시키지 않고 차지만 버린다. 돌아와서 떼는 순간 최대 점프가 나가면 안 된다.
window.addEventListener('pointercancel', (e) => endPointer(e, true))
window.addEventListener('blur', () => {
  owner = null
  cancelCharge(world)
})
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden') return
  owner = null
  cancelCharge(world)
})

// 데스크톱에서 손맛을 보려면 스페이스가 편하다. 입력 자체는 똑같이 하나다.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat) return
  e.preventDefault()
  if (screen === 'play' && world.phase === 'over') {
    if (world.overT > 0.45) restart()
    return
  }
  if (owner) return
  onPress(0, 0)
  if (world.phase === 'charging') owner = { kind: 'key' }
})
window.addEventListener('keyup', (e) => {
  if (e.code !== 'Space') return
  e.preventDefault()
  if (owner && owner.kind !== 'key') return
  owner = null
  release(world)
})

startLoop(
  (raw) => {
    const dt = raw * TIME_SCALE
    screenT += dt
    update(world, dt)
    // 보여줄 광고가 없으면 묻지 않는다. 눌러도 튕기는 버튼은 두지 않는다.
    if (world.phase === 'offer' && !adPending && !ad.ready) {
      declineContinue(world)
    }
    if (screen === 'play' && world.phase === 'over' && !submitted) {
      submitted = true
      submit(world.score.stumps, world.score.bestCombo, totalScore(world.score))
    }
  },
  (alpha, stats) => {
    stage.begin()
    setSpriteScale(stage.scale)
    const { ctx } = stage

    // 물리는 60Hz 고정이라 120Hz 화면에서는 두 스텝 사이를 보간해야 매끄럽다.
    const v = interpolate(world, alpha)
    const sh = shakeOffset(world)
    // 바닥은 레터박스까지 칠한다. 비율이 다른 창에서 경계가 보이면 안 된다.
    drawGround(ctx, v.camX + sh.x, v.camY + sh.y, stage.bleed, stage.scale)
    // 월드도 레터박스까지 그린다. 바닥만 레터박스를 덮고 월드를 디자인
    // 사각형에서 자르면, 비율이 다른 창에서 그루터기가 화면 안쪽 직선에
    // 썰려 보인다. 잘린 단면이 보이는 것보다 이어지는 쪽이 낫다.
    drawWorld(ctx, world, v)
    if (DEBUG) drawDebugWorld(ctx, world, v)
    drawVignette(ctx, stage.bleed)

    if (screen === 'title') {
      drawRecords(ctx, stage.safe)
      drawTitle(ctx, screenT, stage.safe)
    }
    else if (world.phase === 'offer')
      drawOffer(ctx, world, world.overT, {
        scrim: stage.bleed,
        pending: adPending,
      })
    else if (world.phase === 'over')
      drawResult(ctx, world, world.overT, { scrim: stage.bleed })
    else drawHud(ctx, world, stage.safe)

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
