import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-acento/50 focus-visible:ring-offset-2'
    
    const variants = {
      primary: 'bg-acento text-principal hover:bg-acento-hover shadow-sm hover:shadow-md',
      secondary: 'bg-principal text-acento hover:bg-[#1a1a1a] shadow-sm',
      outline: 'border border-borde bg-white hover:border-principal hover:shadow-sm',
      ghost: 'bg-transparent hover:bg-gray-100',
      danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    }
    
    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-6 py-3 text-base'
    }
    
    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
