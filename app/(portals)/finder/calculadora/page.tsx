import { Suspense } from 'react'
import { CalculadoraWorkspace } from '@/components/calculator/CalculadoraWorkspace'

export default function FinderCalculadoraPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-acento border-t-transparent animate-spin" />
        </div>
      }
    >
      <CalculadoraWorkspace portalPrefix="finder" />
    </Suspense>
  )
}
