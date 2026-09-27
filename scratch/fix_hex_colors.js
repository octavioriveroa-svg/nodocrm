const fs = require('fs')
const path = require('path')

const DIRS = ['app', 'components']

const mapping = {
  // Principal (Petróleo / old black)
  '#072b31': 'principal',
  '#072B31': 'principal',
  '#0f0f0f': 'principal',
  '#0F0F0F': 'principal',

  // Acento (Lima / old neon)
  '#cedc00': 'acento',
  '#CEDC00': 'acento',
  '#d7ff2f': 'acento',
  '#D7FF2F': 'acento',

  // Acento hover
  '#b9c600': 'acento-hover',
  '#B9C600': 'acento-hover',
  '#c4ec23': 'acento-hover',

  // Menta
  '#00c19f': 'menta',
  '#00C19F': 'menta',
  
  // Menta hover
  '#00a98b': 'menta-hover',
  '#00A98B': 'menta-hover',

  // Fondo (old cream / new neutro frio)
  '#f4f7f6': 'fondo',
  '#F4F7F6': 'fondo',
  '#f9f6ef': 'fondo',
  '#F9F6EF': 'fondo',
  '#fafafa': 'fondo',

  // Muted
  '#5f7a77': 'muted',
  '#5F7A77': 'muted',
  '#888888': 'muted',

  // Salvia
  '#9ab9ad': 'salvia',
  '#9AB9AD': 'salvia',

  // Verde claro
  '#d1e0d7': 'verde-claro',
  '#D1E0D7': 'verde-claro',

  // Arena
  '#d6d9c7': 'arena',
  '#D6D9C7': 'arena',
}

// Map rgba(7,43,49,.12) etc for borders
const rgbaMapping = {
  'rgba(7,43,49,.12)': 'borde',
  'rgba(200,200,200,.25)': 'borde',
  'rgba(7, 43, 49, 0.12)': 'borde',
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8')
  let originalContent = content

  // Replace Hex
  const hexRegex = /(bg|text|border|ring|fill|stroke|divide)-\[\#([0-9a-fA-F]{3,6})\]/g
  content = content.replace(hexRegex, (match, prefix, hex) => {
    const fullHex = '#' + hex
    if (mapping[fullHex]) {
      return `${prefix}-${mapping[fullHex]}`
    }
    return match // leave alone if not in mapping
  })

  // Replace RGBA
  const rgbaRegex = /(bg|text|border|ring|fill|stroke|divide)-\[(rgba\([^)]+\))\]/g
  content = content.replace(rgbaRegex, (match, prefix, rgbaStr) => {
    // Normalize spaces
    const normalized = rgbaStr.replace(/\s+/g, '')
    const targetMap = {
      'rgba(7,43,49,.12)': 'borde',
      'rgba(200,200,200,.25)': 'borde',
      'rgba(7,43,49,0.12)': 'borde'
    }
    if (targetMap[normalized]) {
      return `${prefix}-${targetMap[normalized]}`
    }
    return match
  })

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8')
    console.log(`Updated: ${filePath}`)
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath)
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath)
    }
  }
}

DIRS.forEach(d => walkDir(d))
console.log('Done.')
