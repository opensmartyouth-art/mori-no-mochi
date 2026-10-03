/** 다음 그루터기가 놓이는 평면상 방향. +x = 화면 우상향, +y = 화면 좌상향. */
export type Dir = 'x' | 'y'

export interface Stump {
  /** 평면 좌표(월드 unit). */
  wx: number
  wy: number
  /** 윗면 반지름. */
  r: number
  /** 윗면 높이. 바닥은 항상 z=0. */
  h: number
  /** 0부터. 시작 그루터기가 0. */
  index: number
}

export type Judgement = 'perfect' | 'ok' | 'miss'
