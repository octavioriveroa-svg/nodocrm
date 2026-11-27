'use client'

import React, { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'nodo_sidebar_collapsed'
const SIDEBAR_CHANGE_EVENT = 'nodo:sidebar-collapsed-change'

function readStoredCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeStoredCollapsed(next: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT))
  } catch {
    // Ignore storage quota / private mode failures gracefully
  }
}

function subscribeCollapsed(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) callback()
  }
  const onCustom = () => callback()
  window.addEventListener('storage', onStorage)
  window.addEventListener(SIDEBAR_CHANGE_EVENT, onCustom)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, onCustom)
  }
}

function getServerSnapshot(): boolean {
  return false
}

export interface SidebarContextValue {
  collapsed: boolean
  setCollapsed: (next: boolean) => void
  toggleCollapsed: () => void
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  setCollapsed: () => {},
  toggleCollapsed: () => {},
})

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readStoredCollapsed,
    getServerSnapshot,
  )

  const setCollapsed = useCallback((next: boolean) => {
    writeStoredCollapsed(next)
  }, [])

  const toggleCollapsed = useCallback(() => {
    writeStoredCollapsed(!readStoredCollapsed())
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      if (e.key.toLowerCase() !== 'b') return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return
      }
      e.preventDefault()
      toggleCollapsed()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleCollapsed])

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, toggleCollapsed }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar(): SidebarContextValue {
  return useContext(SidebarContext)
}
