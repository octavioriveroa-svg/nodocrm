import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT_DIR = path.resolve(__dirname, '../../..')

function collectTsxFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const out: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collectTsxFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      out.push(fullPath)
    }
  }
  return out
}

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8')
}

describe('Calculator modal portal & workspace CSS containing-block guards', () => {
  it('forbids raw fixed inset-0 overlays inside components/calculator/', () => {
    const calcFiles = collectTsxFiles(path.join(ROOT_DIR, 'components/calculator'))
    expect(calcFiles.length).toBeGreaterThan(0)

    const offenders: string[] = []
    for (const filePath of calcFiles) {
      const source = fs.readFileSync(filePath, 'utf8')
      if (/\bfixed\s+inset-0\b/.test(source)) {
        offenders.push(path.relative(ROOT_DIR, filePath))
      }
    }

    expect(
      offenders,
      'Calculator modals must delegate to components/ui/Modal (or createPortal) so ancestor transforms cannot trap fixed overlays.',
    ).toEqual([])
  })

  it('ensures shared Modal primitive portals to document.body without glass-card hover transforms', () => {
    const modalSource = readRepoFile('components/ui/Modal.tsx')

    expect(modalSource).toContain("from 'react-dom'")
    expect(modalSource).toMatch(/createPortal\(\s*modalContent\s*,\s*document\.body\s*\)/)
    expect(modalSource).not.toContain('glass-card')
    expect(modalSource).toContain('useSyncExternalStore')
  })

  it('ensures SimuladorAhorrosSeccion uses .glass-surface on root section and imports Modal', () => {
    const simSource = readRepoFile('components/calculator/SimuladorAhorrosSeccion.tsx')

    expect(simSource).toMatch(/import\s*\{[^}]*\bModal\b[^}]*\}\s*from\s*'@\/components\/ui\/Modal'/)
    expect(simSource).toContain('<section className="glass-surface')
    expect(simSource).not.toContain('<section className="glass-card')
  })

  it('ensures AdminCalculadoraConfig delegates modal mode to <Modal>, uses .glass-surface, and tracks initialTemplates dynamically', () => {
    const adminSource = readRepoFile('components/calculator/AdminCalculadoraConfig.tsx')

    expect(adminSource).toMatch(/import\s*\{[^}]*\bModal\b[^}]*\}\s*from\s*'@\/components\/ui\/Modal'/)
    expect(adminSource).toContain('<Modal')
    expect(adminSource).toContain('glass-surface')
    expect(adminSource).not.toContain('glass-card')
    expect(adminSource).not.toMatch(/useState<[^>]*>\(\s*initialTemplates\s*\)/)
  })

  it('ensures .glass-surface in app/globals.css preserves sticky descendants and avoids transform', () => {
    const cssSource = readRepoFile('app/globals.css')
    const surfaceMatch = cssSource.match(/\.glass-surface\s*\{([^}]*)\}/)

    expect(surfaceMatch).not.toBeNull()
    const body = surfaceMatch![1]
    expect(body).toContain('overflow-x: clip')
    expect(body).not.toContain('overflow: hidden')
    expect(body).not.toMatch(/\btransform\s*:/)
    expect(cssSource).not.toMatch(/\.glass-surface:hover\s*\{[^}]*\btransform\s*:/)
  })
})
