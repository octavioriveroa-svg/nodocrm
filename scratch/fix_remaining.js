const fs = require('fs');

function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  for (const [search, replace] of Object.entries(replacements)) {
    newContent = newContent.split(search).join(replace);
  }
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Fixed', filePath);
  }
}

replaceInFile('app/(portals)/admin/clientes/page.tsx', { 'text-[#444]': 'text-muted' });
replaceInFile('app/(portals)/admin/proyectos/page.tsx', { 'text-[#444]': 'text-muted' });
replaceInFile('app/(portals)/analista/clientes/page.tsx', { 'text-[#444]': 'text-muted' });
replaceInFile('app/(portals)/epc/clientes/page.tsx', { 'text-[#444]': 'text-muted' });
replaceInFile('app/(portals)/finder/clientes/page.tsx', { 'text-[#444]': 'text-muted' });

replaceInFile('app/(portals)/admin/proyectos/nuevo/page.tsx', { 'hover:bg-[#1a1a1a]': 'hover:bg-slate-900' });
replaceInFile('app/(portals)/epc/nuevo/page.tsx', { 'hover:bg-[#1a1a1a]': 'hover:bg-slate-900' });

replaceInFile('components/gantt/ModalHito.tsx', { 'bg-[#F9F6EF]': 'bg-fondo', 'border-[#072B31]': 'border-principal' });
replaceInFile('components/telemetry/EnergyChart.tsx', { '1px solid #E5E7EB': '1px solid var(--color-gray-200)' });
replaceInFile('components/ui/Button.tsx', { 'bg-[#1a1a1a]': 'bg-principal' });
