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

replaceInFile('app/(portals)/epc/clientes/page.tsx', { '#E5E5E5': 'var(--color-borde)' });
replaceInFile('app/(portals)/finder/clientes/page.tsx', { '#E5E5E5': 'var(--color-borde)' });
replaceInFile('components/gantt/ModalHito.tsx', { '#fafff0': 'var(--color-fondo)', '#4a5e1e': 'var(--color-principal)' });
replaceInFile('components/ui/Button.tsx', { 'hover:bg-[#0C3A42]': 'hover:bg-principal/90' });
