/** 보간 유틸. 애니메이션에는 선형을 쓰지 않는다(GDD §10). */

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v

export const clamp01 = (v: number): number => clamp(v, 0, 1)

/** 값 보간 자체는 선형이지만, 넘기는 t 를 항상 ease 로 통과시킨다. */
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)

export const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4)

/** 프레임레이트 비의존 지수 추종. rate 는 60Hz 1프레임 기준 비율. */
export const follow = (rate: number, dt: number): number =>
  1 - Math.pow(1 - rate, dt * 60)
