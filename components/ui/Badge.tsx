import React from 'react'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'info' | 'neutral'
}

export const Badge = ({ className = '', variant = 'default', children, ...props }: BadgeProps) => {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800',
    neutral: 'bg-acento text-principal'
  }
  
  return (
    <span 
      className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${variants[variant]} ${className}`} 
      {...props}
    >
      {children}
    </span>
  )
}
