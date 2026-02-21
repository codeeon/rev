'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAppState } from '@/lib/store'
import { StepHeader } from '@/components/layout/step-header'
import { BottomButton } from '@/components/layout/bottom-button'

const YEARS = Array.from({ length: 90 }, (_, i) => 2010 - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

function getDaysInMonth(year: number, month: number, isLunar: boolean): number {
  if (isLunar) return 30
  return new Date(year, month, 0).getDate()
}

export default function InputPage() {
  const router = useRouter()
  const { state, dispatch } = useAppState()

  const [name, setName] = useState(state.birthInfo.name || '')
  const [year, setYear] = useState<number | ''>(state.birthInfo.year || '')
  const [month, setMonth] = useState<number | ''>(state.birthInfo.month || '')
  const [day, setDay] = useState<number | ''>(state.birthInfo.day || '')
  const [isLunar, setIsLunar] = useState(state.birthInfo.isLunar || false)
  const [gender, setGender] = useState<'male' | 'female' | ''>(state.birthInfo.gender as 'male' | 'female' || '')

  const days = useMemo(() => {
    if (!year || !month) return Array.from({ length: 31 }, (_, i) => i + 1)
    return Array.from({ length: getDaysInMonth(year, month, isLunar) }, (_, i) => i + 1)
  }, [year, month, isLunar])

  const isValid = year && month && day && gender

  function handleNext() {
    if (!isValid) return
    dispatch({
      type: 'SET_BIRTH_INFO',
      payload: {
        name: name || undefined,
        year: year as number,
        month: month as number,
        day: day as number,
        isLunar,
        gender: gender as 'male' | 'female',
      },
    })
    router.push('/branch')
  }

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader title="기본 정보" backHref="/" />

      <div className="flex flex-1 flex-col gap-8 px-5 pb-4 pt-4">
        {/* Name */}
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-muted-foreground">
            이름 <span className="text-muted-foreground/60">(선택)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 입력해주세요"
            className="h-12 rounded-xl border border-input bg-card px-4 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Calendar Type */}
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-muted-foreground">
            양력 / 음력 <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-2">
            {[
              { label: '양력', value: false },
              { label: '음력', value: true },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => setIsLunar(opt.value)}
                className={`flex h-11 flex-1 items-center justify-center rounded-xl text-[15px] font-medium transition-all ${
                  isLunar === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-muted-foreground">
            생년월일 <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-2">
            <select
              value={year}
              onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}
              className="h-12 flex-1 rounded-xl border border-input bg-card px-3 text-[15px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">년</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <select
              value={month}
              onChange={(e) => {
                setMonth(e.target.value ? Number(e.target.value) : '')
                setDay('')
              }}
              className="h-12 w-24 rounded-xl border border-input bg-card px-3 text-[15px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">월</option>
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
            <select
              value={day}
              onChange={(e) => setDay(e.target.value ? Number(e.target.value) : '')}
              className="h-12 w-24 rounded-xl border border-input bg-card px-3 text-[15px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">일</option>
              {days.map((d) => (
                <option key={d} value={d}>
                  {d}일
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Gender */}
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-muted-foreground">
            성별 <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-2">
            {[
              { label: '남성', value: 'male' as const },
              { label: '여성', value: 'female' as const },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGender(opt.value)}
                className={`flex h-11 flex-1 items-center justify-center rounded-xl text-[15px] font-medium transition-all ${
                  gender === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <BottomButton onClick={handleNext} disabled={!isValid}>
        다음
      </BottomButton>
    </div>
  )
}
