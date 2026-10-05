/**
 * 리워드 광고.
 *
 * 앱인토스 SDK v3 의 함수형 API 형태에 맞춘다(공식 문서 확인).
 *
 *   loadFullScreenAd({ options: { adGroupId }, onEvent, onError })   → 'loaded'
 *   showFullScreenAd({ options: { adGroupId }, onEvent, onError })   → 'userEarnedReward', 'dismissed'
 *
 * 보상 이벤트는 **show 쪽 콜백**으로 온다. load 쪽이 아니다.
 * 보상은 **`userEarnedReward` 에서만** 지급한다. `dismissed` 는 '광고가 닫혔다'
 * 일 뿐이라 거기서 주면 끝까지 안 보고도 받는다.
 * 광고 종류는 함수 이름이 아니라 콘솔에서 발급한 **광고 그룹 ID** 로 정해진다.
 *
 * SDK 연결은 `toss-sdk.ts` 한 곳에서만 한다. 연결되지 않았을 때:
 *   - 개발 서버이거나 ?debug=1 이면 모의 구현(1.2초 뒤 성공)
 *   - 그 밖(배포 빌드)에서는 **광고 없음** — 이어하기를 묻지 않는다
 * 배포 빌드에서까지 모의로 떨어지면 광고 없이 공짜로 이어하기가 된다.
 */
import { AD_GROUP_ID, AD_MOCK_DELAY } from '../config'
import { sdkAds } from './toss-sdk'

export interface RewardedAd {
  /** 지금 바로 보여줄 수 있는지. */
  readonly ready: boolean
  /** 미리 받아 둔다. 죽은 뒤에 받기 시작하면 기다리게 된다. */
  preload(): void
  /** 보상 조건을 채웠으면 true. 취소·실패는 false. */
  show(): Promise<boolean>
}

export type AdEvent =
  | { type: 'loaded' }
  | { type: 'userEarnedReward'; data: { unitType: string; unitAmount: number } }
  | { type: 'dismissed' }
  | { type: string; data?: unknown }

interface AdCall {
  options: { adGroupId: string }
  onEvent: (e: AdEvent) => void
  onError: (e: unknown) => void
}

/** SDK 가 내보내는 두 함수의 모양. */
export interface AdApi {
  loadFullScreenAd: ((call: AdCall) => void) & { isSupported?: () => boolean }
  showFullScreenAd: (call: AdCall) => void
}

const UNAVAILABLE: RewardedAd = {
  ready: false,
  preload: () => {},
  show: async () => false,
}

export function createSdkAd(api: AdApi, adGroupId: string): RewardedAd {
  const supported = api.loadFullScreenAd.isSupported?.() ?? true
  if (!supported) return UNAVAILABLE

  let loaded = false
  let loading = false

  const load = (): void => {
    if (loading || loaded) return
    loading = true
    api.loadFullScreenAd({
      options: { adGroupId },
      onEvent: (e) => {
        if (e.type === 'loaded') {
          loaded = true
          loading = false
        }
      },
      onError: () => {
        loaded = false
        loading = false
      },
    })
  }

  return {
    get ready() {
      return loaded
    },
    preload: load,
    show() {
      if (!loaded) return Promise.resolve(false)
      // 한 번 보여준 광고는 다시 못 쓴다. 다음 것을 새로 받아야 한다.
      loaded = false
      return new Promise<boolean>((resolve) => {
        let earned = false
        let done = false
        const finish = (ok: boolean): void => {
          if (done) return
          done = true
          resolve(ok)
          load()
        }
        api.showFullScreenAd({
          options: { adGroupId },
          onEvent: (e) => {
            // 보상은 여기서만. dismissed 에서 주면 안 본 사람도 받는다.
            if (e.type === 'userEarnedReward') earned = true
            else if (e.type === 'dismissed') finish(earned)
          },
          onError: () => finish(false),
        })
      })
    },
  }
}

/** 모의 광고를 써도 되는 환경인가. 배포 빌드에서는 절대 켜지면 안 된다. */
function mockAllowed(): boolean {
  if (import.meta.env.DEV) return true
  return new URLSearchParams(location.search).get('debug') === '1'
}

/** 로컬 개발용. ?ad=fail 이면 실패를, ?ad=none 이면 미지원을 흉내낸다. */
function createMockAd(): RewardedAd {
  const mode = new URLSearchParams(location.search).get('ad')
  if (mode === 'none') return UNAVAILABLE
  return {
    ready: true,
    preload: () => {},
    show: () =>
      new Promise((resolve) =>
        setTimeout(() => resolve(mode !== 'fail'), AD_MOCK_DELAY),
      ),
  }
}

export function createRewardedAd(): RewardedAd {
  if (sdkAds) return createSdkAd(sdkAds, AD_GROUP_ID)
  return mockAllowed() ? createMockAd() : UNAVAILABLE
}
