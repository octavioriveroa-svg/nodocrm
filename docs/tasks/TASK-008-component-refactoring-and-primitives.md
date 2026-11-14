# Task Specification: TASK-008 — Component Refactoring, UI Primitives & Tailwind Consolidation

**Task ID**: `TASK-008`  
**Task Title**: Monolithic Component Decomposition, Headless UI Primitives & Tailwind Configuration Cleanup  
**Target Subsystem**: UI Architecture & Design System (`components/ui/`, `components/proyectos/`, `components/InstalacionMonitor.tsx`, `tailwind.config.ts`)  
**Priority**: P2 / P3 (Maintainability & Codebase Architecture)  
**Severity**: Low (Developer ergonomics, component readability, design token centralization)  
**Status**: Completed & Verified  

---

## 1. Problem Statement & Root Cause

### 1.1 Problem Statement
1. **Monolithic Component Complexity**: `components/proyectos/ProjectWizard.tsx` is 1,391 lines long, managing multiple state machines, validation rules, site selections, product mappings, and RPC persistence in a single file. Similarly, `components/InstalacionMonitor.tsx` is 674 lines, combining evidence upload, gallery rendering, lightbox viewing, and comment threads.
2. **Missing UI Primitives**: `components/ui/` only provides 6 basic atomics (`Badge`, `Button`, `Card`, `Input`, `StatFigure`, `StepIndicator`). Common patterns like modal dialogs, dropdown menus, and tab bars are implemented with inline markup, duplicate backdrop blur styling, and bespoke state handlers in every consumer file.
3. **Dual Tailwind Configuration**: The project runs Tailwind CSS v4 with official tokens defined in the `@theme` block of `app/globals.css`. However, a legacy `tailwind.config.ts` file still exists with redundant color mappings, creating potential configuration drift.

---

## 2. Scope Boundaries

### In-Scope
1. Author reusable primitives in `components/ui/`:
   - `components/ui/Modal.tsx`: Accessible dialog with `.glass-card` styling, backdrop blur, Escape key listener, outside-click listener, and focus management.
   - `components/ui/DropdownMenu.tsx`: Accessible action dropdown with outside-click dismissal and keyboard navigation.
   - `components/ui/Tabs.tsx`: Composable tabs with brand active indicators (`border-acento`).
2. Decompose `ProjectWizard.tsx`:
   - Extract state management and step progression into `components/proyectos/wizard/useProjectWizardState.ts`.
   - Reduce `ProjectWizard.tsx` line count below 400 lines.
3. Decompose `InstalacionMonitor.tsx`:
   - Extract `components/instalaciones/EvidenciaGallery.tsx` and `components/instalaciones/EvidenciaLightbox.tsx`.
4. Clean up `tailwind.config.ts` to rely on `app/globals.css` `@theme` definitions.
5. Verify that all 4 verification gates pass cleanly without visual regressions.

### Out-of-Scope
- Changing business logic, validations, or RPC calls in `ProjectWizard`.
- Altering the visual design tokens (Petróleo `#072B31`, Lima `#CEDC00`, Menta `#00C19F`).

---

## 3. Technical Prerequisites & Dependencies
- **Dependencies**: Phases 1–4 completed.
- **UI Stack**: React 19, Tailwind CSS v4, Lucide React icons.

---

## 4. Inputs
- Target Components: `components/proyectos/ProjectWizard.tsx`, `components/InstalacionMonitor.tsx`
- Design Tokens: `app/globals.css` (`@theme` block)
- Legacy Config: `tailwind.config.ts`

---

## 5. Step-by-Step Implementation Instructions

### Step 1: Create Headless / Standard UI Primitives
1. Create `components/ui/Modal.tsx`:
```typescript
'use client'

import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxWidth?: string // e.g., 'max-w-xl', 'max-w-3xl'
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-principal/60 backdrop-blur-md animate-fade-in"
    >
      <div className={`w-full ${maxWidth} glass-card p-6 border border-borde shadow-2xl relative max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-borde/60">
          {title && <h3 className="text-lg font-bold text-principal font-heading">{title}</h3>}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-principal hover:bg-black/5 transition-colors ml-auto"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
```

2. Create `components/ui/DropdownMenu.tsx` and `components/ui/Tabs.tsx` following consistent brand styling.

### Step 2: Decompose `ProjectWizard.tsx`
1. Create `components/proyectos/wizard/useProjectWizardState.ts` exporting custom hook `useProjectWizardState(portalType, initialClient)` managing:
   - `step`, `setStep`
   - `projectData`, `updateProjectData`
   - `selectedSites`, `setSelectedSites`
   - `configs`, `setConfigs`
   - `financing`, `setFinancing`
   - `isSubmitting`, `submitError`, `handleSubmit`
2. In `ProjectWizard.tsx`, consume `useProjectWizardState` and render step components (`StepGeneralInfo`, `StepSites`, `StepTechnical`, `StepFinancing`).

### Step 3: Decompose `InstalacionMonitor.tsx` (Preserving Static Test Guards)
1. Extract `components/instalaciones/EvidenciaGallery.tsx` for photo grid rendering with category badges.
2. Extract `components/instalaciones/EvidenciaLightbox.tsx` for full-screen inspection, consuming `components/ui/Modal.tsx`.
3. Import both into `components/InstalacionMonitor.tsx`.
4. **CRITICAL STATIC TEST GUARD (`tests/adversarial-m3-empirical.test.mjs:150-179`)**:
   Test `Instalaciones.2` in `tests/adversarial-m3-empirical.test.mjs` reads `components/InstalacionMonitor.tsx` as raw UTF-8 text and asserts the exact substrings:
   - `"{!readOnly && (currentUser.id === ev.autor_id || currentUser.rol === 'nodo_admin') && ("`
   - `"!readOnly"` preceding `"setUploadTarget({ type: 'fase'"`
   - `"!readOnly"` preceding `"setUploadTarget({ type: 'actividad'"`
   - `"!readOnly"` preceding `"setUploadTarget({ type: 'tarea'"`
   Ensure those exact guard expressions remain present inside `components/InstalacionMonitor.tsx` (for example, by passing the rendered delete button or keeping the guard expression in `InstalacionMonitor.tsx`) so that `npx tsx tests/adversarial-m3-empirical.test.mjs` passes 100%.

### Step 4: Consolidate `tailwind.config.ts`
Review `tailwind.config.ts` and remove duplicated custom color definitions that are already declared via `@theme` in `app/globals.css`.

---

## 6. Outputs
- **New Primitives**: `components/ui/Modal.tsx`, `components/ui/DropdownMenu.tsx`, `components/ui/Tabs.tsx`
- **Extracted Hook**: `components/proyectos/wizard/useProjectWizardState.ts`
- **Extracted Components**: `components/instalaciones/EvidenciaGallery.tsx`, `components/instalaciones/EvidenciaLightbox.tsx`
- **Refactored Files**: `components/proyectos/ProjectWizard.tsx`, `components/InstalacionMonitor.tsx`, `tailwind.config.ts`

---

## 7. Acceptance Criteria & Exact Verification Commands

### Criteria
- [x] `components/ui/Modal.tsx` handles Escape key, backdrop click, and accessible modal structure cleanly.
- [x] `ProjectWizard.tsx` is under 400 lines of code (303 lines).
- [x] All 4 project creation flows (Admin, Analista, EPC, Finder) execute without regressions (`ProjectWizard` & `npm test`).
- [x] All verification gates pass cleanly: `tsc`, `lint`, `test`, `adversarial-m3-empirical`, `build`.

### Verification Command
```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```
**Expected Output**:
All four commands exit with code 0.
