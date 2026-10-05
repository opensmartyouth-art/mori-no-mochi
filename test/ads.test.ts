import { describe, expect, it } from 'vitest'
import { createSdkAd, type AdApi, type AdEvent } from '../src/platform/ads'

/**
 * 앱인토스 SDK v3 문서의 호출 형태를 흉내 낸 가짜.
 *   loadFullScreenAd({ options: { adGroupId }, onEvent, onError }) → 'loaded'
 *   showFullScreenAd({ options: { adGroupId }, onEvent, onError }) → 'userEarnedReward', 'dismissed'
 * 실제 SDK 를 붙이기 전에 어댑터가 이 모양대로 부르는지를 고정한다.
 */
type Call = {
  options: { adGroupId: string }
  onEvent: (e: AdEvent) => void
  onError: (e: unknown) => void
}

function fakeSdk(opts: { supported?: boolean } = {}) {
  const loads: Call[] = []
  const shows: Call[] = []
  const load = ((c: Call) => {
    loads.push(c)
  }) as AdApi['loadFullScreenAd']
  load.isSupported = () => opts.supported ?? true
  const api: AdApi = {
    loadFullScreenAd: load,
    showFullScreenAd: (c: Call) => {
      shows.push(c)
    },
  }
  return { api, loads, shows }
}

describe('리워드 광고 어댑터', () => {
  it('광고 그룹 ID 를 options 안에 넣어 부른다', () => {
    const f = fakeSdk()
    const ad = createSdkAd(f.api, 'grp-1')
    ad.preload()
    expect(f.loads).toHaveLength(1)
    expect(f.loads[0]!.options).toEqual({ adGroupId: 'grp-1' })
  })

  it('loaded 이벤트가 오기 전에는 준비되지 않은 상태다', async () => {
    const f = fakeSdk()
    const ad = createSdkAd(f.api, 'g')
    ad.preload()
    expect(ad.ready).toBe(false)
    expect(await ad.show()).toBe(false)
    expect(f.shows).toHaveLength(0)
    f.loads[0]!.onEvent({ type: 'loaded' })
    expect(ad.ready).toBe(true)
  })

  it('끝까지 보면(userEarnedReward → dismissed) 보상을 준다', async () => {
    const f = fakeSdk()
    const ad = createSdkAd(f.api, 'g')
    ad.preload()
    f.loads[0]!.onEvent({ type: 'loaded' })
    const p = ad.show()
    expect(f.shows[0]!.options).toEqual({ adGroupId: 'g' })
    f.shows[0]!.onEvent({
      type: 'userEarnedReward',
      data: { unitType: 'continue', unitAmount: 1 },
    })
    f.shows[0]!.onEvent({ type: 'dismissed' })
    expect(await p).toBe(true)
  })

  it('보상 없이 닫으면(dismissed 만) 보상을 주지 않는다', async () => {
    const f = fakeSdk()
    const ad = createSdkAd(f.api, 'g')
    ad.preload()
    f.loads[0]!.onEvent({ type: 'loaded' })
    const p = ad.show()
    f.shows[0]!.onEvent({ type: 'dismissed' })
    expect(await p).toBe(false)
  })

  it('보상 이벤트는 show 쪽에서 받는다 — load 쪽으로 와도 무시한다', async () => {
    const f = fakeSdk()
    const ad = createSdkAd(f.api, 'g')
    ad.preload()
    f.loads[0]!.onEvent({ type: 'loaded' })
    f.loads[0]!.onEvent({
      type: 'userEarnedReward',
      data: { unitType: 'x', unitAmount: 1 },
    })
    const p = ad.show()
    f.shows[0]!.onEvent({ type: 'dismissed' })
    expect(await p).toBe(false)
  })

  it('재생 중 오류면 보상을 주지 않는다', async () => {
    const f = fakeSdk()
    const ad = createSdkAd(f.api, 'g')
    ad.preload()
    f.loads[0]!.onEvent({ type: 'loaded' })
    const p = ad.show()
    f.shows[0]!.onError(new Error('boom'))
    expect(await p).toBe(false)
  })

  it('한 번 보여준 뒤에는 다음 광고를 다시 받는다', async () => {
    const f = fakeSdk()
    const ad = createSdkAd(f.api, 'g')
    ad.preload()
    f.loads[0]!.onEvent({ type: 'loaded' })
    const p = ad.show()
    // 보여주는 순간 이미 소모된 것으로 본다
    expect(ad.ready).toBe(false)
    f.shows[0]!.onEvent({ type: 'dismissed' })
    await p
    expect(f.loads).toHaveLength(2)
  })

  it('지원하지 않는 환경이면 아예 부르지 않는다', async () => {
    const f = fakeSdk({ supported: false })
    const ad = createSdkAd(f.api, 'g')
    ad.preload()
    expect(f.loads).toHaveLength(0)
    expect(ad.ready).toBe(false)
    expect(await ad.show()).toBe(false)
  })
})
