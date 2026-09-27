import sys

file_path = r"c:\Users\vmont\projects\Nodo\nodocrm\app\(portals)\admin\proyectos\nuevo\page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    (
"""        {/* ══ PASO 2 — Financiamiento ═══════════════════════════ */}
        {step === 2 && (""",
"""        {/* ══ PASO 2 — Financiamiento ═══════════════════════════ */}
        {step === 2 && !isNodoBusca && ("""
    ),
    (
"""          {step < 2 ? (
            <button type="button" onClick={handleNext}
              className="px-6 py-2.5 text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition-all active:scale-[0.98] bg-acento text-principal rounded-xl">
              Siguiente
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading}
              className="px-6 py-2.5 text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50 hover:bg-[#1a1a1a]"
              style={{ backgroundColor: 'var(--color-principal)', color: 'var(--color-acento)' }}>
              {loading ? 'Enviando...' : 'Enviar proyecto'}
            </button>
          )}""",
"""          {step < 2 && !(isNodoBusca && step === 1) ? (
            <button type="button" onClick={handleNext}
              className="px-6 py-2.5 text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition-all active:scale-[0.98] bg-acento text-principal rounded-xl">
              Siguiente
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading}
              className="px-6 py-2.5 text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50 hover:bg-[#1a1a1a]"
              style={{ backgroundColor: 'var(--color-principal)', color: 'var(--color-acento)' }}>
              {loading ? 'Enviando...' : 'Enviar proyecto'}
            </button>
          )}"""
    )
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
    else:
        print(f"Warning: Could not find block")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
