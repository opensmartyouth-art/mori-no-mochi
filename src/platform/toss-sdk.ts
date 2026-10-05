/**
 * 앱인토스 SDK 연결 지점. **SDK 를 붙일 때 이 파일 한 곳만 바꾼다.**
 *
 * SDK 는 토스 앱이 전역으로 주입하지 않는다. npm 으로 설치해서 정적 import 로
 * 번들에 넣어야 한다(공식 문서). 그래서 동적 import 나 전역 탐지로는 붙일 수 없고,
 * 설치 전에 정적 import 를 써 두면 빌드가 깨진다. 설치 전까지는 null 로 둔다.
 *
 * 설치 후:
 *   npm install @apps-in-toss/web-framework
 * 그리고 아래 두 줄을 이렇게 바꾼다.
 *
 *   import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework'
 *   export const sdkAds: AdApi | null = { loadFullScreenAd, showFullScreenAd }
 *
 * 콘솔에서 발급받은 광고 그룹 ID 로 config.ts 의 AD_GROUP_ID 도 바꿔야 한다.
 */
import type { AdApi } from './ads'

export const sdkAds: AdApi | null = null
