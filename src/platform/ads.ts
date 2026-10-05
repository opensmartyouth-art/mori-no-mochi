/**
 * 리워드 광고.
 *
 * 앱인토스 문서 기준 API 는 `@apps-in-toss/web-framework` 의
 * `loadFullScreenAd` / `showFullScreenAd` 이고, 광고 종류는 함수 이름이 아니라
 * 콘솔에서 발급한 **광고 그룹 ID** 로 정해진다.
 *
 * 보상은 **`userEarnedReward` 이벤트에서만** 지급한다.
 * `dismissed` 는 '광고가 닫혔다' 일 뿐이라 거기서 주면 끝까지 안 보고도 받는다.
 *
 * SDK 가 없을 때:
 *   - 개발 서버이거나 ?debug=1 이면 모의 구현(1.2초 뒤 성공)으로 떨어진다
 *   - 그 밖(배포 빌드)에서는 **광고 없음**으로 처리한다
 * 배포 빌드에서까지 모의로 떨어지면 광고 없이 공짜로 이어하기가 된다.
 * 게임 쪽 코드는 어느 쪽인지 몰라도 되게 인터페이스 하나만 본다.
 */
import { AD_GROUP_ID, AD_MOCK_DELAY } from '../config'

export interface RewardedAd {
  /** 지금 바로 보여줄 수 있는지. */
  readonly ready: boolean
  /** 미리 받아 둔다. 죽은 뒤에 받기 시작하면 기다리게 된다. */
  preload(): void
  /** 보상 조건을 채웠으면 true. 취소·실패는 false. */
  show(): Promise<boolean>
}

type AdEvent =
  | { type: 'loaded' }
  | { type: 'userEarnedReward'; data: { unitType: string; unitAmount: number } }
  | { type: 'dismissed' }

interface AdApi {
  loadFullScreenAd(opts: {
    adGroupId: string
    onEvent: (e: AdEvent) => void
    onError: (e: unknown) => void
  }): void
  showFullScreenAd(opts: { adGroupId: string }): void
}

/** SDK 가 붙어 있으면 그걸, 아니면 null. */
async function loadSdk(): Promise<AdApi | null> {
  try {
    // 번들러가 없는 의존성을 정적 분석하지 않도록 변수를 거친다.
    const name = '@apps-in-toss/web-framework'
    const mod = (await import(/* @vite-ignore */ name)) as Partial<AdApi>
    if (
      typeof mod.loadFullScreenAd === 'function' &&
      typeof mod.showFullScreenAd === 'function'
    ) {
      return mod as AdApi
    }
  } catch {
    // 미설치거나 토스 앱 밖이다. 모의 구현으로 간다.
  }
  return null
}

function createSdkAd(api: AdApi, adGroupId: string): RewardedAd {
  let loaded = false
  let pending: ((ok: boolean) => void) | null = null
  let earned = false

  const settle = (ok: boolean): void => {
    const p = pending
    pending = null
    if (p) p(ok)
  }

  const load = (): void => {
    loaded = false
    earned = false
    api.loadFullScreenAd({
      adGroupId,
      onEvent: (e) => {
        if (e.type === 'loaded') loaded = true
        // 보상은 여기서만. dismissed 에서 주면 안 본 사람도 받는다.
        else if (e.type === 'userEarnedReward') earned = true
        else if (e.type === 'dismissed') {
          settle(earned)
          load() // 다음을 위해 다시 받아 둔다
        }
      },
      onError: () => {
        loaded = false
        settle(false)
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
      return new Promise<boolean>((resolve) => {
        pending = resolve
        api.showFullScreenAd({ adGroupId })
      })
    },
  }
}

const UNAVAILABLE: RewardedAd = {
  ready: false,
  preload: () => {},
  show: async () => false,
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
  let inner: RewardedAd = mockAllowed() ? createMockAd() : UNAVAILABLE
  void loadSdk().then((api) => {
    if (api) {
      inner = createSdkAd(api, AD_GROUP_ID)
      inner.preload()
    }
  })
  return {
    get ready() {
      return inner.ready
    },
    preload: () => inner.preload(),
    show: () => inner.show(),
  }
}
