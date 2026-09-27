const fs = require('fs');
const path = require('path');

const DIRS = ['app', 'components'];

const colorMap = {
  '#072b31': 'principal',
  '#072b31': 'principal',
  '#0f0f0f': 'principal',
  '#cedc00': 'acento',
  '#d7ff2f': 'acento',
  '#b9c600': 'acento-hover',
  '#c4ec23': 'acento-hover',
  '#00c19f': 'menta',
  '#00a98b': 'menta-hover',
  '#f4f7f6': 'fondo',
  '#f9f6ef': 'fondo',
  '#5f7a77': 'muted',
  '#9ab9ad': 'salvia',
  '#d1e0d7': 'verde-claro',
  '#d6d9c7': 'arena',

  '#0369a1': 'sky-700',
  '#059669': 'emerald-600',
  '#0891b2': 'cyan-600',
  '#10b981': 'emerald-500',
  '#15803d': 'green-700',
  '#1a1a2e': 'slate-900',
  '#2563eb': 'blue-600',
  '#3b82f6': 'blue-500',
  '#4f46e5': 'indigo-600',
  '#7c3aed': 'violet-600',
  '#7e22ce': 'purple-700',
  '#856404': 'yellow-800',
  '#888': 'gray-400',
  '#888888': 'gray-400',
  '#92400e': 'amber-800',
  '#999': 'gray-400',
  '#9ca3af': 'gray-400',
  '#aaa': 'gray-300',
  '#be185d': 'pink-700',
  '#c00': 'red-600',
  '#cbd5e1': 'slate-300',
  '#d97706': 'amber-600',
  '#dc2626': 'red-600',
  '#dcfce7': 'green-100',
  '#e0f2fe': 'sky-100',
  '#e5e5e5': 'neutral-200',
  '#e5e7eb': 'gray-200',
  '#e8e8e8': 'gray-200',
  '#ecfdf5': 'emerald-50',
  '#eee': 'gray-200',
  '#ef4444': 'red-500',
  '#eff6ff': 'blue-50',
  '#f0f0f0': 'gray-100',
  '#f0f9ff': 'sky-50',
  '#f3e8ff': 'purple-100',
  '#f3f4f6': 'gray-100',
  '#f59e0b': 'amber-500',
  '#f8fbf5': 'green-50',
  '#fafafa': 'neutral-50',
  '#fbfdf9': 'green-50',
  '#fde68a': 'amber-200',
  '#fef2f2': 'red-50',
  '#fff': 'white',
  '#fff3cd': 'yellow-100',
  '#fff5f5': 'red-50',
  '#fffbeb': 'amber-50',
  '#fffff0': 'yellow-50',
  '#ffffff': 'white'
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  // 1. Replace Tailwind arbitrary classes: bg-[#c00] -> bg-red-600
  const twRegex = /(bg|text|border|ring|fill|stroke|divide)-\[\#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\]/g;
  content = content.replace(twRegex, (match, prefix, hex) => {
    const fullHex = ('#' + hex).toLowerCase();
    if (colorMap[fullHex]) {
      return `${prefix}-${colorMap[fullHex]}`;
    }
    return match;
  });

  // 2. Replace raw strings: '#c00' -> 'var(--color-red-600)'
  const strRegex = /(['"`])\#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\1/g;
  content = content.replace(strRegex, (match, quote, hex) => {
    const fullHex = ('#' + hex).toLowerCase();
    if (colorMap[fullHex]) {
      return `${quote}var(--color-${colorMap[fullHex]})${quote}`;
    }
    return match;
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated: ${filePath}`);
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(file => {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      processFile(p);
    }
  });
}

DIRS.forEach(d => walk(d));
console.log('Done.');
