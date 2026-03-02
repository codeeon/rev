declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar
    getLunar(): Lunar
  }

  export class Lunar {
    static fromYmd(year: number, month: number, day: number): Lunar
    getSolar(): Solar
    getEightChar(): {
      getYearGan(): string
      getYearZhi(): string
      getMonthGan(): string
      getMonthZhi(): string
      getDayGan(): string
      getDayZhi(): string
    }
  }
}
