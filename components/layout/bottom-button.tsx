'use client'

import { cn } from '@/lib/utils'

interface BottomButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
  type?: 'button' | 'submit'
  className?: string
}

export function BottomButton({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  type = 'button',
  className,
}: BottomButtonProps) {
  return (
    <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-background/0 px-5 pb-8 pt-4">
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'flex h-14 w-full items-center justify-center rounded-2xl text-[17px] font-semibold transition-all duration-200',
          variant === 'primary' && 'bg-primary text-primary-foreground hover:opacity-90',
          variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
          disabled && 'cursor-not-allowed opacity-40',
          className,
        )}
      >
        {children}
      </button>
    </div>
  )
}
