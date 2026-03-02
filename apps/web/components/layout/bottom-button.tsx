'use client'

import { cn } from '@workspace/base-ui/lib/utils'
import { Button } from '@workspace/base-ui/components/button'

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
      <Button
        type={type}
        onClick={onClick}
        disabled={disabled}
        variant={variant === 'primary' ? 'default' : 'secondary'}
        size="lg"
        className={cn(
          'h-14 w-full rounded-2xl text-[17px] font-semibold transition-all duration-200',
          variant === 'primary' && 'hover:opacity-90',
          disabled && 'cursor-not-allowed opacity-40',
          className,
        )}
      >
        {children}
      </Button>
    </div>
  )
}
