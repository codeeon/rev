declare module 'lunar-javascript' {
  export class EightChar {
    getYearGan(): string
    getYearZhi(): string
    getMonthGan(): string
    getMonthZhi(): string
    getDayGan(): string
    getDayZhi(): string
    getTimeGan(): string
    getTimeZhi(): string
  }

  export class Lunar {
    static fromDate(date: Date): Lunar
    static fromYmd(y: number, m: number, d: number): Lunar
    getYear(): number
    getMonth(): number
    getDay(): number
    getEightChar(): EightChar
    getSolar(): Solar
  }

  export class Solar {
    static fromDate(date: Date): Solar
    static fromYmd(y: number, m: number, d: number): Solar
    getLunar(): Lunar
    getYear(): number
    getMonth(): number
    getDay(): number
  }
}
