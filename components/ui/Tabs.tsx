'use client'

import React from 'react'

export interface TabItem {
  id: string
  label: React.ReactNode
  badge?: React.ReactNode
  disabled?: boolean
}

export interface TabsProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (tabId: string) => void
  className?: string
  variant?: 'underline' | 'pill'
}

/**
 * Composable tab bar with active border-acento indicator or compact pill mode.
 */
export function Tabs({
  tabs,
  activeTab,
  onChange,
  className = '',
  variant = 'underline',
}: TabsProps) {
  if (variant === 'pill') {
    return (
      <div
        role="tablist"
        className={`inline-flex items-center bg-gray-100 rounded-lg p-1 gap-1 ${className}`}
      >
        {tabs.map(tab => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40 ${
                isActive
                  ? 'bg-white shadow-sm text-principal'
                  : 'text-gray-500 hover:text-principal'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      role="tablist"
      className={`flex flex-wrap items-center gap-1 border-b border-borde ${className}`}
    >
      {tabs.map(tab => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px disabled:opacity-40 ${
              isActive
                ? 'border-acento text-principal font-bold'
                : 'border-transparent text-gray-500 hover:text-principal'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge}
          </button>
        )
      })}
    </div>
  )
}
