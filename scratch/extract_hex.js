const fs = require('fs');
const path = require('path');
const hexes = new Set();
const regex = /['"`]#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;

function walk(dir) {
  if(!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(file => {
    const p = path.join(dir, file);
    if(fs.statSync(p).isDirectory()) walk(p);
    else if(p.endsWith('.tsx') || p.endsWith('.ts')) {
      const c = fs.readFileSync(p, 'utf8');
      let match;
      while((match = regex.exec(c)) !== null) {
        hexes.add(match[0].toLowerCase().replace(/['"`]/, ''));
      }
    }
  });
}
walk('app'); walk('components');
console.log([...hexes].sort());
