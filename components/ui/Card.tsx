import React from 'react'

export const Card = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`glass-card ${className}`} {...props}>
    {children}
  </div>
)

export const CardHeader = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col space-y-1.5 px-6 pt-6 pb-2 ${className}`} {...props}>
    {children}
  </div>
)

export const CardTitle = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`font-semibold text-xs uppercase tracking-widest text-gray-400 px-6 pt-5 pb-0 ${className}`} {...props}>
    {children}
  </h3>
)

export const CardContent = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`px-6 pb-6 pt-3 ${className}`} {...props}>
    {children}
  </div>
)
