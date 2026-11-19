import type { FormulaDefinicion } from '@/lib/types'
import { isKnownPlatformIdentifier } from '@/lib/calculator/variable-dictionary'

export type FormulaErrorCode = '#DIV/0!' | '#VALUE!' | '#REF!' | '#NAME?' | '#CYCLE!' | '#NUM!'

export class FormulaError extends Error {
  readonly code: FormulaErrorCode

  constructor(code: FormulaErrorCode, message: string) {
    super(`${code}: ${message}`)
    this.name = 'FormulaError'
    this.code = code
  }
}

export type FormulaScalar = number | string | boolean
export type FormulaValue = FormulaScalar | number[]

export const MAX_FORMULA_LENGTH = 2000
export const MAX_AST_DEPTH = 32
export const MAX_AST_NODES = 512
export const MAX_RANGE_CELLS = 5000
export const MAX_IRR_ITERATIONS = 100

const FORBIDDEN_IDENTIFIERS = new Set<string>([
  'constructor',
  '__proto__',
  'prototype',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
])

// ── AST Node Definitions ──────────────────────────────────────────────────────

export interface NumberLitNode {
  type: 'NumberLit'
  value: number
}

export interface StringLitNode {
  type: 'StringLit'
  value: string
}

export interface BoolLitNode {
  type: 'BoolLit'
  value: boolean
}

export interface VarRefNode {
  type: 'VarRef'
  name: string
}

export interface CellRefNode {
  type: 'CellRef'
  sheet?: string
  col: string
  row: number
  ref: string
  fullRef: string
}

export interface RangeRefNode {
  type: 'RangeRef'
  sheet?: string
  start: CellRefNode
  end: CellRefNode
  fullRef: string
}

export interface UnaryOpNode {
  type: 'UnaryOp'
  op: '+' | '-' | '%'
  operand: ASTNode
}

export type BinaryOperator =
  | '+'
  | '-'
  | '*'
  | '/'
  | '^'
  | '&'
  | '='
  | '<>'
  | '<'
  | '<='
  | '>'
  | '>='

export interface BinaryOpNode {
  type: 'BinaryOp'
  op: BinaryOperator
  left: ASTNode
  right: ASTNode
}

export interface CallExprNode {
  type: 'CallExpr'
  name: string
  args: ASTNode[]
}

export type ASTNode =
  | NumberLitNode
  | StringLitNode
  | BoolLitNode
  | VarRefNode
  | CellRefNode
  | RangeRefNode
  | UnaryOpNode
  | BinaryOpNode
  | CallExprNode

// ── Cell Reference Utilities ──────────────────────────────────────────────────

const MAX_EXCEL_COL = 16384 // XFD
const MAX_EXCEL_ROW = 1048576
const CELL_REF_REGEX = /^\$?([A-Za-z]{1,3})\$?([1-9][0-9]*)$/

export function colLettersToIndex(col: string): number {
  const upper = col.toUpperCase()
  let num = 0
  for (let i = 0; i < upper.length; i++) {
    num = num * 26 + (upper.charCodeAt(i) - 64)
  }
  return num
}

export function indexToColLetters(index: number): string {
  let n = index
  let col = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    col = String.fromCharCode(65 + rem) + col
    n = Math.floor((n - 1) / 26)
  }
  return col
}

export function parseCellRefToken(raw: string, sheet?: string): CellRefNode | null {
  const match = CELL_REF_REGEX.exec(raw)
  if (!match) return null
  const col = match[1].toUpperCase()
  const row = Number(match[2])
  const colIdx = colLettersToIndex(col)
  if (colIdx < 1 || colIdx > MAX_EXCEL_COL || !Number.isInteger(row) || row < 1 || row > MAX_EXCEL_ROW) {
    return null
  }
  const ref = `${col}${row}`
  const cleanSheet = sheet ? sheet.trim() : undefined
  const fullRef = cleanSheet ? `${cleanSheet}!${ref}` : ref
  return {
    type: 'CellRef',
    sheet: cleanSheet,
    col,
    row,
    ref,
    fullRef,
  }
}

/**
 * Normalizes Excel cell references by stripping '$' anchors and unquoting sheet names.
 * Examples: "$B$5" -> "B5", "'Hoja 1'!$B$5" -> "Hoja 1!B5".
 */
export function normalizeCellRef(raw: string): string {
  const trimmed = raw.trim()
  const bangIdx = trimmed.lastIndexOf('!')
  if (bangIdx >= 0) {
    let sheetPart = trimmed.slice(0, bangIdx).trim()
    if (sheetPart.startsWith("'") && sheetPart.endsWith("'") && sheetPart.length >= 2) {
      sheetPart = sheetPart.slice(1, -1).replace(/''/g, "'")
    }
    const cellPart = trimmed.slice(bangIdx + 1).trim()
    const parsed = parseCellRefToken(cellPart, sheetPart)
    return parsed ? parsed.fullRef : `${sheetPart}!${cellPart.replace(/\$/g, '').toUpperCase()}`
  }
  const parsed = parseCellRefToken(trimmed)
  return parsed ? parsed.ref : trimmed.replace(/\$/g, '').toUpperCase()
}

export function expandRangeRef(range: RangeRefNode): string[] {
  const startCol = colLettersToIndex(range.start.col)
  const endCol = colLettersToIndex(range.end.col)
  const minCol = Math.min(startCol, endCol)
  const maxCol = Math.max(startCol, endCol)
  const minRow = Math.min(range.start.row, range.end.row)
  const maxRow = Math.max(range.start.row, range.end.row)

  const cellCount = (maxCol - minCol + 1) * (maxRow - minRow + 1)
  if (cellCount > MAX_RANGE_CELLS) {
    throw new FormulaError(
      '#REF!',
      `El rango ${range.fullRef} excede el límite máximo de ${MAX_RANGE_CELLS} celdas.`,
    )
  }

  const refs: string[] = []
  const prefix = range.sheet ? `${range.sheet}!` : ''
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      refs.push(`${prefix}${indexToColLetters(c)}${r}`)
    }
  }
  return refs
}

// ── Lexer ─────────────────────────────────────────────────────────────────────

type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'IDENT'
  | 'SHEET_CELL'
  | 'OP'
  | 'LPAREN'
  | 'RPAREN'
  | 'SEP'
  | 'COLON'
  | 'PERCENT'
  | 'EOF'

interface Token {
  type: TokenType
  value: string
  sheet?: string
  pos: number
}

function isIdentStart(ch: string): boolean {
  const code = ch.charCodeAt(0)
  return (
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    ch === '_' ||
    ch === '$'
  )
}

function isIdentPart(ch: string): boolean {
  const code = ch.charCodeAt(0)
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) ||
    ch === '_' ||
    ch === '$' ||
    ch === '.'
  )
}

function isDigit(ch: string): boolean {
  const code = ch.charCodeAt(0)
  return code >= 48 && code <= 57
}

function tokenize(rawInput: string): Token[] {
  const trimmed = rawInput.trim()
  if (trimmed.length === 0) {
    throw new FormulaError('#VALUE!', 'La fórmula está vacía.')
  }
  if (trimmed.length > MAX_FORMULA_LENGTH) {
    throw new FormulaError(
      '#VALUE!',
      `La fórmula supera el límite de ${MAX_FORMULA_LENGTH} caracteres.`,
    )
  }

  const input = trimmed.startsWith('=') ? trimmed.slice(1) : trimmed
  const tokens: Token[] = []
  let i = 0
  const len = input.length

  while (i < len) {
    const ch = input[i]

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      i++
      continue
    }

    // Number literal
    if (isDigit(ch) || (ch === '.' && i + 1 < len && isDigit(input[i + 1]))) {
      const start = i
      while (i < len && isDigit(input[i])) i++
      if (i < len && input[i] === '.') {
        i++
        while (i < len && isDigit(input[i])) i++
      }
      if (i < len && (input[i] === 'e' || input[i] === 'E')) {
        const expPos = i
        i++
        if (i < len && (input[i] === '+' || input[i] === '-')) i++
        if (i < len && isDigit(input[i])) {
          while (i < len && isDigit(input[i])) i++
        } else {
          i = expPos
        }
      }
      tokens.push({ type: 'NUMBER', value: input.slice(start, i), pos: start })
      continue
    }

    // String literal ("...") with "" escape
    if (ch === '"') {
      const start = i
      i++
      let str = ''
      let closed = false
      while (i < len) {
        if (input[i] === '"') {
          if (i + 1 < len && input[i + 1] === '"') {
            str += '"'
            i += 2
            continue
          }
          i++
          closed = true
          break
        }
        str += input[i]
        i++
      }
      if (!closed) {
        throw new FormulaError('#VALUE!', 'Cadena de texto sin comilla de cierre.')
      }
      tokens.push({ type: 'STRING', value: str, pos: start })
      continue
    }

    // Quoted sheet name: 'Hoja 1'!$B$5
    if (ch === "'") {
      const start = i
      i++
      let sheet = ''
      let closed = false
      while (i < len) {
        if (input[i] === "'") {
          if (i + 1 < len && input[i + 1] === "'") {
            sheet += "'"
            i += 2
            continue
          }
          i++
          closed = true
          break
        }
        sheet += input[i]
        i++
      }
      if (!closed || i >= len || input[i] !== '!') {
        throw new FormulaError('#REF!', 'Referencia de hoja mal formada (se esperaba !).')
      }
      i++ // consume '!'
      const cellStart = i
      while (i < len && (isIdentPart(input[i]) && input[i] !== '.')) i++
      const cellRaw = input.slice(cellStart, i)
      if (!cellRaw) {
        throw new FormulaError('#REF!', 'Falta referencia de celda después del nombre de hoja.')
      }
      tokens.push({ type: 'SHEET_CELL', sheet, value: cellRaw, pos: start })
      continue
    }

    // Identifiers, dotted function names, cell refs, or unquoted Sheet!Cell
    if (isIdentStart(ch)) {
      const start = i
      while (i < len && isIdentPart(input[i])) i++
      const word = input.slice(start, i)

      // Check for unquoted Sheet!Cell
      if (i < len && input[i] === '!') {
        i++ // consume '!'
        const cellStart = i
        while (i < len && (isIdentPart(input[i]) && input[i] !== '.')) i++
        const cellRaw = input.slice(cellStart, i)
        if (!cellRaw) {
          throw new FormulaError('#REF!', `Falta celda después de ${word}!.`)
        }
        tokens.push({ type: 'SHEET_CELL', sheet: word, value: cellRaw, pos: start })
        continue
      }

      tokens.push({ type: 'IDENT', value: word, pos: start })
      continue
    }

    // Two-character comparison operators
    if (i + 1 < len) {
      const two = input.slice(i, i + 2)
      if (two === '<=' || two === '>=' || two === '<>' || two === '!=') {
        tokens.push({ type: 'OP', value: two === '!=' ? '<>' : two, pos: i })
        i += 2
        continue
      }
    }

    // Single-character operators and punctuation
    if (
      ch === '+' ||
      ch === '-' ||
      ch === '*' ||
      ch === '/' ||
      ch === '^' ||
      ch === '&' ||
      ch === '=' ||
      ch === '<' ||
      ch === '>'
    ) {
      tokens.push({ type: 'OP', value: ch, pos: i })
      i++
      continue
    }
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', pos: i })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', pos: i })
      i++
      continue
    }
    if (ch === ',' || ch === ';') {
      tokens.push({ type: 'SEP', value: ch, pos: i })
      i++
      continue
    }
    if (ch === ':') {
      tokens.push({ type: 'COLON', value: ':', pos: i })
      i++
      continue
    }
    if (ch === '%') {
      tokens.push({ type: 'PERCENT', value: '%', pos: i })
      i++
      continue
    }

    throw new FormulaError('#VALUE!', `Carácter inesperado "${ch}" en la posición ${i + 1}.`)
  }

  tokens.push({ type: 'EOF', value: '', pos: len })
  return tokens
}

// ── Recursive-Descent Parser (Excel Precedence) ───────────────────────────────

class Parser {
  private readonly tokens: Token[]
  private pos = 0
  private nodeCount = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek(): Token {
    return this.tokens[this.pos]
  }

  private consume(): Token {
    return this.tokens[this.pos++]
  }

  private registerNode<T extends ASTNode>(node: T): T {
    this.nodeCount++
    if (this.nodeCount > MAX_AST_NODES) {
      throw new FormulaError(
        '#VALUE!',
        `La fórmula excede el máximo de ${MAX_AST_NODES} nodos AST permitidos.`,
      )
    }
    return node
  }

  private checkDepth(depth: number): void {
    if (depth > MAX_AST_DEPTH) {
      throw new FormulaError(
        '#VALUE!',
        `La fórmula excede la profundidad máxima permitida (${MAX_AST_DEPTH}).`,
      )
    }
  }

  parse(): ASTNode {
    const ast = this.parseComparison(1)
    if (this.peek().type !== 'EOF') {
      throw new FormulaError(
        '#VALUE!',
        `Token inesperado "${this.peek().value}" al final de la fórmula.`,
      )
    }
    return ast
  }

  private parseComparison(depth: number): ASTNode {
    this.checkDepth(depth)
    let left = this.parseConcat(depth)
    while (
      this.peek().type === 'OP' &&
      (this.peek().value === '=' ||
        this.peek().value === '<>' ||
        this.peek().value === '<' ||
        this.peek().value === '<=' ||
        this.peek().value === '>' ||
        this.peek().value === '>=')
    ) {
      const op = this.consume().value as BinaryOperator
      const right = this.parseConcat(depth + 1)
      left = this.registerNode({ type: 'BinaryOp', op, left, right })
    }
    return left
  }

  private parseConcat(depth: number): ASTNode {
    this.checkDepth(depth)
    let left = this.parseAdditive(depth)
    while (this.peek().type === 'OP' && this.peek().value === '&') {
      this.consume()
      const right = this.parseAdditive(depth + 1)
      left = this.registerNode({ type: 'BinaryOp', op: '&', left, right })
    }
    return left
  }

  private parseAdditive(depth: number): ASTNode {
    this.checkDepth(depth)
    let left = this.parseMultiplicative(depth)
    while (
      this.peek().type === 'OP' &&
      (this.peek().value === '+' || this.peek().value === '-')
    ) {
      const op = this.consume().value as '+' | '-'
      const right = this.parseMultiplicative(depth + 1)
      left = this.registerNode({ type: 'BinaryOp', op, left, right })
    }
    return left
  }

  private parseMultiplicative(depth: number): ASTNode {
    this.checkDepth(depth)
    let left = this.parsePower(depth)
    while (
      this.peek().type === 'OP' &&
      (this.peek().value === '*' || this.peek().value === '/')
    ) {
      const op = this.consume().value as '*' | '/'
      const right = this.parsePower(depth + 1)
      left = this.registerNode({ type: 'BinaryOp', op, left, right })
    }
    return left
  }

  /**
   * Excel exponentiation:
   * - LEFT-associative: 2^3^2 = (2^3)^2 = 64
   * - Lower precedence than unary +/-: -2^2 = (-2)^2 = 4; 2^-3 = 2^(-3) = 0.125
   */
  private parsePower(depth: number): ASTNode {
    this.checkDepth(depth)
    let left = this.parseUnary(depth)
    while (this.peek().type === 'OP' && this.peek().value === '^') {
      this.consume()
      const right = this.parseUnary(depth + 1)
      left = this.registerNode({ type: 'BinaryOp', op: '^', left, right })
    }
    return left
  }

  private parseUnary(depth: number): ASTNode {
    this.checkDepth(depth)
    if (
      this.peek().type === 'OP' &&
      (this.peek().value === '+' || this.peek().value === '-')
    ) {
      const op = this.consume().value as '+' | '-'
      const operand = this.parseUnary(depth + 1)
      return this.registerNode({ type: 'UnaryOp', op, operand })
    }
    return this.parsePostfix(depth)
  }

  private parsePostfix(depth: number): ASTNode {
    this.checkDepth(depth)
    let node = this.parsePrimary(depth)
    while (this.peek().type === 'PERCENT') {
      this.consume()
      node = this.registerNode({ type: 'UnaryOp', op: '%', operand: node })
    }
    return node
  }

  private parsePrimary(depth: number): ASTNode {
    this.checkDepth(depth)
    const tok = this.peek()

    if (tok.type === 'NUMBER') {
      this.consume()
      const val = Number(tok.value)
      if (!Number.isFinite(val)) {
        throw new FormulaError('#NUM!', `Número inválido: ${tok.value}`)
      }
      return this.registerNode({ type: 'NumberLit', value: val })
    }

    if (tok.type === 'STRING') {
      this.consume()
      return this.registerNode({ type: 'StringLit', value: tok.value })
    }

    if (tok.type === 'LPAREN') {
      this.consume()
      const expr = this.parseComparison(depth + 1)
      if (this.peek().type !== 'RPAREN') {
        throw new FormulaError('#VALUE!', 'Falta paréntesis de cierre ")".')
      }
      this.consume()
      return expr
    }

    if (tok.type === 'SHEET_CELL') {
      this.consume()
      const startCell = parseCellRefToken(tok.value, tok.sheet)
      if (!startCell) {
        throw new FormulaError('#REF!', `Referencia de celda inválida: ${tok.sheet}!${tok.value}`)
      }
      this.registerNode(startCell)
      return this.maybeParseRange(startCell)
    }

    if (tok.type === 'IDENT') {
      this.consume()
      // Function call if immediately followed by '('
      if (this.peek().type === 'LPAREN') {
        this.consume() // '('
        const args: ASTNode[] = []
        if (this.peek().type !== 'RPAREN') {
          args.push(this.parseComparison(depth + 1))
          while (this.peek().type === 'SEP') {
            this.consume()
            args.push(this.parseComparison(depth + 1))
          }
        }
        if (this.peek().type !== 'RPAREN') {
          throw new FormulaError('#VALUE!', `Falta ")" en llamada a ${tok.value}().`)
        }
        this.consume() // ')'
        return this.registerNode({
          type: 'CallExpr',
          name: tok.value.toUpperCase(),
          args,
        })
      }

      // Boolean literals
      const upper = tok.value.toUpperCase()
      if (upper === 'TRUE' || upper === 'VERDADERO') {
        return this.registerNode({ type: 'BoolLit', value: true })
      }
      if (upper === 'FALSE' || upper === 'FALSO') {
        return this.registerNode({ type: 'BoolLit', value: false })
      }

      // Check cell ref (never contains '_' or '.')
      if (!tok.value.includes('_') && !tok.value.includes('.')) {
        const cellNode = parseCellRefToken(tok.value)
        if (cellNode) {
          this.registerNode(cellNode)
          return this.maybeParseRange(cellNode)
        }
      }

      // Reject '$' inside non-cell variable names
      if (tok.value.includes('$')) {
        throw new FormulaError('#REF!', `Referencia inválida: ${tok.value}`)
      }

      return this.registerNode({ type: 'VarRef', name: tok.value })
    }

    throw new FormulaError(
      '#VALUE!',
      `Expresión inesperada cerca de "${tok.value || 'fin de fórmula'}".`,
    )
  }

  private maybeParseRange(startCell: CellRefNode): CellRefNode | RangeRefNode {
    if (this.peek().type !== 'COLON') {
      return startCell
    }
    this.consume() // ':'
    const endTok = this.peek()
    let endCell: CellRefNode | null = null
    if (endTok.type === 'IDENT') {
      this.consume()
      endCell = parseCellRefToken(endTok.value, startCell.sheet)
    } else if (endTok.type === 'SHEET_CELL') {
      this.consume()
      endCell = parseCellRefToken(endTok.value, endTok.sheet ?? startCell.sheet)
    }
    if (!endCell) {
      throw new FormulaError('#REF!', `Rango inválido después de ${startCell.fullRef}:.`)
    }
    this.registerNode(endCell)
    const sheet = startCell.sheet ?? endCell.sheet
    const fullRef = sheet
      ? `${sheet}!${startCell.ref}:${endCell.ref}`
      : `${startCell.ref}:${endCell.ref}`
    return this.registerNode({
      type: 'RangeRef',
      sheet,
      start: startCell,
      end: endCell,
      fullRef,
    })
  }
}

export function parseExcelFormula(expression: string): ASTNode {
  const tokens = tokenize(expression)
  const parser = new Parser(tokens)
  return parser.parse()
}

// ── Function Allowlist (Map-backed, EN + ES Aliases) ──────────────────────────

function toNumber(val: FormulaValue, context: string): number {
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) {
      throw new FormulaError('#NUM!', `Resultado numérico no finito en ${context}.`)
    }
    return val
  }
  if (typeof val === 'boolean') return val ? 1 : 0
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (trimmed === '') return 0
    const n = Number(trimmed)
    if (Number.isFinite(n)) return n
    throw new FormulaError('#VALUE!', `No se pudo convertir "${val}" a número en ${context}.`)
  }
  throw new FormulaError('#VALUE!', `Valor de rango no esperado en ${context}.`)
}

function toBoolean(val: FormulaValue): boolean {
  if (typeof val === 'boolean') return val
  if (typeof val === 'number') return val !== 0
  if (typeof val === 'string') {
    const up = val.trim().toUpperCase()
    if (up === 'TRUE' || up === 'VERDADERO') return true
    if (up === 'FALSE' || up === 'FALSO' || up === '') return false
    const n = Number(up)
    if (Number.isFinite(n)) return n !== 0
    throw new FormulaError('#VALUE!', `Valor booleano inválido: "${val}".`)
  }
  throw new FormulaError('#VALUE!', 'Se esperaba un valor lógico escalar.')
}

function flattenNumbers(values: FormulaValue[], context: string): number[] {
  const out: number[] = []
  for (const val of values) {
    if (Array.isArray(val)) {
      for (const n of val) {
        if (!Number.isFinite(n)) {
          throw new FormulaError('#NUM!', `Valor no finito en ${context}.`)
        }
        out.push(n)
      }
    } else if (typeof val === 'number') {
      if (!Number.isFinite(val)) {
        throw new FormulaError('#NUM!', `Valor no finito en ${context}.`)
      }
      out.push(val)
    } else if (typeof val === 'boolean') {
      out.push(val ? 1 : 0)
    } else if (typeof val === 'string' && val.trim() !== '') {
      const n = Number(val.trim())
      if (!Number.isFinite(n)) {
        throw new FormulaError('#VALUE!', `Argumento no numérico "${val}" en ${context}.`)
      }
      out.push(n)
    }
  }
  return out
}

function excelRoundHalfAway(value: number, digits: number): number {
  const factor = Math.pow(10, digits)
  if (!Number.isFinite(factor)) return value
  const sign = value < 0 ? -1 : 1
  return (sign * Math.round(Math.abs(value) * factor + 1e-12)) / factor
}

function excelRoundUp(value: number, digits: number): number {
  const factor = Math.pow(10, digits)
  if (!Number.isFinite(factor)) return value
  const sign = value < 0 ? -1 : 1
  return (sign * Math.ceil(Math.abs(value) * factor - 1e-12)) / factor
}

function excelRoundDown(value: number, digits: number): number {
  const factor = Math.pow(10, digits)
  if (!Number.isFinite(factor)) return value
  const sign = value < 0 ? -1 : 1
  return (sign * Math.floor(Math.abs(value) * factor + 1e-12)) / factor
}

export function solveIrrRate(cashflows: readonly number[], guess: number = 0.1): number | null {
  if (cashflows.length < 2) return null
  let hasPos = false
  let hasNeg = false
  for (const cf of cashflows) {
    if (!Number.isFinite(cf)) return null
    if (cf > 0) hasPos = true
    if (cf < 0) hasNeg = true
  }
  if (!hasPos || !hasNeg) return null

  const npvAt = (r: number): number => {
    let total = 0
    let denom = 1
    const base = 1 + r
    for (let t = 0; t < cashflows.length; t++) {
      if (t > 0) denom *= base
      if (!Number.isFinite(denom) || denom === 0) return Number.NaN
      total += cashflows[t] / denom
    }
    return total
  }

  const dNpvAt = (r: number): number => {
    let total = 0
    const base = 1 + r
    let denom = base
    for (let t = 1; t < cashflows.length; t++) {
      denom *= base
      if (!Number.isFinite(denom) || denom === 0) return Number.NaN
      total -= (t * cashflows[t]) / denom
    }
    return total
  }

  // Phase 1: Newton-Raphson from guess (and fallback initial seeds)
  const seeds = [guess, 0.01, 0.05, 0.1, -0.05]
  for (const seed of seeds) {
    let r = seed
    for (let iter = 0; iter < MAX_IRR_ITERATIONS; iter++) {
      if (r <= -0.999999 || r > 100) break
      const f = npvAt(r)
      if (!Number.isFinite(f)) break
      if (Math.abs(f) < 1e-9) return r
      const df = dNpvAt(r)
      if (!Number.isFinite(df) || Math.abs(df) < 1e-14) break
      const next = r - f / df
      if (!Number.isFinite(next)) break
      if (Math.abs(next - r) < 1e-10) {
        if (Math.abs(npvAt(next)) < 1e-6) return next
        break
      }
      r = next
    }
  }

  // Phase 2: Bracketed bisection fallback across [-0.99, 10.0]
  const grid = [
    -0.99, -0.9, -0.75, -0.5, -0.25, -0.1, -0.05, -0.01, 0,
    0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0,
  ]
  for (let i = 0; i < grid.length - 1; i++) {
    let lo = grid[i]
    let hi = grid[i + 1]
    let fLo = npvAt(lo)
    const fHi = npvAt(hi)
    if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) continue
    if (Math.abs(fLo) < 1e-9) return lo
    if (Math.abs(fHi) < 1e-9) return hi
    if (fLo * fHi < 0) {
      for (let iter = 0; iter < MAX_IRR_ITERATIONS; iter++) {
        const mid = (lo + hi) / 2
        const fMid = npvAt(mid)
        if (!Number.isFinite(fMid)) break
        if (Math.abs(fMid) < 1e-9 || Math.abs(hi - lo) < 1e-11) return mid
        if (fLo * fMid <= 0) {
          hi = mid
        } else {
          lo = mid
          fLo = fMid
        }
      }
      return (lo + hi) / 2
    }
  }

  return null
}

type EagerFn = (args: FormulaValue[]) => FormulaValue

const EAGER_FUNCTIONS = new Map<string, EagerFn>()

function registerFn(names: readonly string[], fn: EagerFn): void {
  for (const name of names) {
    EAGER_FUNCTIONS.set(name.toUpperCase(), fn)
  }
}

// Boolean constants / logic
registerFn(['TRUE', 'VERDADERO'], () => true)
registerFn(['FALSE', 'FALSO'], () => false)
registerFn(['AND', 'Y'], (args) => {
  if (args.length === 0) throw new FormulaError('#VALUE!', 'AND/Y requiere al menos 1 argumento.')
  return args.every((a) => toBoolean(a))
})
registerFn(['OR', 'O'], (args) => {
  if (args.length === 0) throw new FormulaError('#VALUE!', 'OR/O requiere al menos 1 argumento.')
  return args.some((a) => toBoolean(a))
})
registerFn(['NOT', 'NO'], (args) => {
  if (args.length !== 1) throw new FormulaError('#VALUE!', 'NOT/NO requiere exactamente 1 argumento.')
  return !toBoolean(args[0])
})

// Math
registerFn(['SUM', 'SUMA'], (args) => {
  const nums = flattenNumbers(args, 'SUM')
  return nums.reduce((acc, n) => acc + n, 0)
})
registerFn(['AVERAGE', 'PROMEDIO'], (args) => {
  const nums = flattenNumbers(args, 'AVERAGE')
  if (nums.length === 0) throw new FormulaError('#DIV/0!', 'AVERAGE/PROMEDIO sin valores.')
  return nums.reduce((acc, n) => acc + n, 0) / nums.length
})
registerFn(['MIN'], (args) => {
  const nums = flattenNumbers(args, 'MIN')
  if (nums.length === 0) return 0
  let m = nums[0]
  for (let i = 1; i < nums.length; i++) if (nums[i] < m) m = nums[i]
  return m
})
registerFn(['MAX'], (args) => {
  const nums = flattenNumbers(args, 'MAX')
  if (nums.length === 0) return 0
  let m = nums[0]
  for (let i = 1; i < nums.length; i++) if (nums[i] > m) m = nums[i]
  return m
})
registerFn(['ABS'], (args) => {
  if (args.length !== 1) throw new FormulaError('#VALUE!', 'ABS requiere 1 argumento.')
  return Math.abs(toNumber(args[0], 'ABS'))
})
registerFn(['ROUND', 'REDONDEAR'], (args) => {
  if (args.length < 1 || args.length > 2) {
    throw new FormulaError('#VALUE!', 'ROUND/REDONDEAR requiere 1 o 2 argumentos.')
  }
  const n = toNumber(args[0], 'ROUND')
  const digits = args.length === 2 ? Math.trunc(toNumber(args[1], 'ROUND')) : 0
  return excelRoundHalfAway(n, digits)
})
registerFn(['ROUNDUP', 'REDONDEAR.MAS'], (args) => {
  if (args.length < 1 || args.length > 2) {
    throw new FormulaError('#VALUE!', 'ROUNDUP/REDONDEAR.MAS requiere 1 o 2 argumentos.')
  }
  const n = toNumber(args[0], 'ROUNDUP')
  const digits = args.length === 2 ? Math.trunc(toNumber(args[1], 'ROUNDUP')) : 0
  return excelRoundUp(n, digits)
})
registerFn(['ROUNDDOWN', 'REDONDEAR.MENOS'], (args) => {
  if (args.length < 1 || args.length > 2) {
    throw new FormulaError('#VALUE!', 'ROUNDDOWN/REDONDEAR.MENOS requiere 1 o 2 argumentos.')
  }
  const n = toNumber(args[0], 'ROUNDDOWN')
  const digits = args.length === 2 ? Math.trunc(toNumber(args[1], 'ROUNDDOWN')) : 0
  return excelRoundDown(n, digits)
})
registerFn(['POWER', 'POTENCIA'], (args) => {
  if (args.length !== 2) throw new FormulaError('#VALUE!', 'POWER/POTENCIA requiere 2 argumentos.')
  const base = toNumber(args[0], 'POWER')
  const exp = toNumber(args[1], 'POWER')
  const res = Math.pow(base, exp)
  if (!Number.isFinite(res)) {
    throw new FormulaError('#NUM!', 'Resultado no finito en POWER/POTENCIA.')
  }
  return res
})
registerFn(['SQRT', 'RAIZ'], (args) => {
  if (args.length !== 1) throw new FormulaError('#VALUE!', 'SQRT/RAIZ requiere 1 argumento.')
  const n = toNumber(args[0], 'SQRT')
  if (n < 0) throw new FormulaError('#NUM!', 'SQRT/RAIZ de número negativo.')
  return Math.sqrt(n)
})
registerFn(['LN'], (args) => {
  if (args.length !== 1) throw new FormulaError('#VALUE!', 'LN requiere 1 argumento.')
  const n = toNumber(args[0], 'LN')
  if (n <= 0) throw new FormulaError('#NUM!', 'LN requiere argumento > 0.')
  return Math.log(n)
})
registerFn(['LOG10'], (args) => {
  if (args.length !== 1) throw new FormulaError('#VALUE!', 'LOG10 requiere 1 argumento.')
  const n = toNumber(args[0], 'LOG10')
  if (n <= 0) throw new FormulaError('#NUM!', 'LOG10 requiere argumento > 0.')
  return Math.log10(n)
})
registerFn(['EXP'], (args) => {
  if (args.length !== 1) throw new FormulaError('#VALUE!', 'EXP requiere 1 argumento.')
  const res = Math.exp(toNumber(args[0], 'EXP'))
  if (!Number.isFinite(res)) throw new FormulaError('#NUM!', 'Desbordamiento en EXP.')
  return res
})
registerFn(['MOD', 'RESIDUO'], (args) => {
  if (args.length !== 2) throw new FormulaError('#VALUE!', 'MOD/RESIDUO requiere 2 argumentos.')
  const n = toNumber(args[0], 'MOD')
  const d = toNumber(args[1], 'MOD')
  if (d === 0) throw new FormulaError('#DIV/0!', 'División por cero en MOD/RESIDUO.')
  return n - d * Math.floor(n / d)
})

// Financial
registerFn(['PMT', 'PAGO'], (args) => {
  if (args.length < 3 || args.length > 5) {
    throw new FormulaError('#VALUE!', 'PMT/PAGO requiere entre 3 y 5 argumentos.')
  }
  const rate = toNumber(args[0], 'PMT')
  const nper = toNumber(args[1], 'PMT')
  const pv = toNumber(args[2], 'PMT')
  const fv = args.length >= 4 ? toNumber(args[3], 'PMT') : 0
  const type = args.length >= 5 ? toNumber(args[4], 'PMT') : 0
  if (nper === 0) throw new FormulaError('#DIV/0!', 'nper no puede ser 0 en PMT/PAGO.')
  if (Math.abs(rate) < 1e-15) {
    return -(pv + fv) / nper
  }
  const pvif = Math.pow(1 + rate, nper)
  const denom = (1 + rate * type) * (pvif - 1)
  if (!Number.isFinite(pvif) || denom === 0) {
    throw new FormulaError('#NUM!', 'Parámetros inválidos en PMT/PAGO.')
  }
  return (-rate * (pv * pvif + fv)) / denom
})

registerFn(['PV', 'VA'], (args) => {
  if (args.length < 3 || args.length > 5) {
    throw new FormulaError('#VALUE!', 'PV/VA requiere entre 3 y 5 argumentos.')
  }
  const rate = toNumber(args[0], 'PV')
  const nper = toNumber(args[1], 'PV')
  const pmt = toNumber(args[2], 'PV')
  const fv = args.length >= 4 ? toNumber(args[3], 'PV') : 0
  const type = args.length >= 5 ? toNumber(args[4], 'PV') : 0
  if (Math.abs(rate) < 1e-15) {
    return -(pmt * nper + fv)
  }
  const pvif = Math.pow(1 + rate, nper)
  if (!Number.isFinite(pvif) || pvif === 0) {
    throw new FormulaError('#NUM!', 'Parámetros inválidos en PV/VA.')
  }
  return -(pmt * (1 + rate * type) * ((pvif - 1) / rate) + fv) / pvif
})

registerFn(['FV', 'VF'], (args) => {
  if (args.length < 3 || args.length > 5) {
    throw new FormulaError('#VALUE!', 'FV/VF requiere entre 3 y 5 argumentos.')
  }
  const rate = toNumber(args[0], 'FV')
  const nper = toNumber(args[1], 'FV')
  const pmt = toNumber(args[2], 'FV')
  const pv = args.length >= 4 ? toNumber(args[3], 'FV') : 0
  const type = args.length >= 5 ? toNumber(args[4], 'FV') : 0
  if (Math.abs(rate) < 1e-15) {
    return -(pv + pmt * nper)
  }
  const pvif = Math.pow(1 + rate, nper)
  if (!Number.isFinite(pvif)) {
    throw new FormulaError('#NUM!', 'Parámetros inválidos en FV/VF.')
  }
  return -(pv * pvif + pmt * (1 + rate * type) * ((pvif - 1) / rate))
})

registerFn(['NPV', 'VNA'], (args) => {
  if (args.length < 2) {
    throw new FormulaError('#VALUE!', 'NPV/VNA requiere tasa y al menos un flujo.')
  }
  const rate = toNumber(args[0], 'NPV')
  if (rate <= -1) throw new FormulaError('#NUM!', 'La tasa en NPV/VNA debe ser > -1.')
  const flows = flattenNumbers(args.slice(1), 'NPV')
  let total = 0
  let denom = 1
  const base = 1 + rate
  for (let i = 0; i < flows.length; i++) {
    denom *= base
    total += flows[i] / denom
  }
  return total
})

registerFn(['IRR', 'TIR'], (args) => {
  if (args.length < 1 || args.length > 2) {
    throw new FormulaError('#VALUE!', 'IRR/TIR requiere un rango/arreglo y opcionalmente un estimado.')
  }
  const flows = flattenNumbers([args[0]], 'IRR')
  const guess = args.length === 2 ? toNumber(args[1], 'IRR') : 0.1
  const solved = solveIrrRate(flows, guess)
  if (solved === null) {
    throw new FormulaError('#NUM!', 'No se pudo converger una TIR válida para los flujos proporcionados.')
  }
  return solved
})

const LAZY_FUNCTIONS = new Set<string>(['IF', 'SI', 'IFERROR', 'SI.ERROR', 'COALESCE'])

export function isKnownExcelFunction(name: string): boolean {
  const upper = name.toUpperCase()
  return LAZY_FUNCTIONS.has(upper) || EAGER_FUNCTIONS.has(upper)
}

// ── AST Evaluator (Map-backed Scope, Zero eval) ───────────────────────────────

export function evaluateFormulaAst(
  node: ASTNode,
  scope: ReadonlyMap<string, FormulaValue>,
): FormulaValue {
  switch (node.type) {
    case 'NumberLit':
      return node.value
    case 'StringLit':
      return node.value
    case 'BoolLit':
      return node.value

    case 'VarRef': {
      if (FORBIDDEN_IDENTIFIERS.has(node.name)) {
        throw new FormulaError('#NAME?', `Identificador prohibido: "${node.name}".`)
      }
      if (!scope.has(node.name)) {
        throw new FormulaError('#NAME?', `Variable desconocida: "${node.name}".`)
      }
      return scope.get(node.name)!
    }

    case 'CellRef': {
      if (scope.has(node.fullRef)) {
        return scope.get(node.fullRef)!
      }
      if (!node.sheet && scope.has(node.ref)) {
        return scope.get(node.ref)!
      }
      throw new FormulaError('#REF!', `Celda no mapeada o desconocida: "${node.fullRef}".`)
    }

    case 'RangeRef': {
      const refs = expandRangeRef(node)
      const values: number[] = []
      for (const ref of refs) {
        if (!scope.has(ref)) {
          throw new FormulaError('#REF!', `Celda "${ref}" del rango ${node.fullRef} no está mapeada.`)
        }
        values.push(toNumber(scope.get(ref)!, node.fullRef))
      }
      return values
    }

    case 'UnaryOp': {
      const val = toNumber(evaluateFormulaAst(node.operand, scope), `operador ${node.op}`)
      if (node.op === '+') return +val
      if (node.op === '-') return -val
      return val / 100
    }

    case 'BinaryOp': {
      const leftVal = evaluateFormulaAst(node.left, scope)
      const rightVal = evaluateFormulaAst(node.right, scope)

      switch (node.op) {
        case '+':
          return toNumber(leftVal, '+') + toNumber(rightVal, '+')
        case '-':
          return toNumber(leftVal, '-') - toNumber(rightVal, '-')
        case '*': {
          const prod = toNumber(leftVal, '*') * toNumber(rightVal, '*')
          if (!Number.isFinite(prod)) throw new FormulaError('#NUM!', 'Desbordamiento en multiplicación.')
          return prod
        }
        case '/': {
          const num = toNumber(leftVal, '/')
          const den = toNumber(rightVal, '/')
          if (den === 0) throw new FormulaError('#DIV/0!', 'División entre cero.')
          const q = num / den
          if (!Number.isFinite(q)) throw new FormulaError('#NUM!', 'Resultado no finito en división.')
          return q
        }
        case '^': {
          const res = Math.pow(toNumber(leftVal, '^'), toNumber(rightVal, '^'))
          if (!Number.isFinite(res)) throw new FormulaError('#NUM!', 'Resultado no finito en potencia (^).')
          return res
        }
        case '&':
          return `${String(leftVal)}${String(rightVal)}`
        case '=':
          return compareValues(leftVal, rightVal) === 0
        case '<>':
          return compareValues(leftVal, rightVal) !== 0
        case '<':
          return compareValues(leftVal, rightVal) < 0
        case '<=':
          return compareValues(leftVal, rightVal) <= 0
        case '>':
          return compareValues(leftVal, rightVal) > 0
        case '>=':
          return compareValues(leftVal, rightVal) >= 0
      }
    }

    case 'CallExpr': {
      const fnName = node.name.toUpperCase()

      // Lazy / short-circuit special forms
      if (fnName === 'IF' || fnName === 'SI') {
        if (node.args.length < 2 || node.args.length > 3) {
          throw new FormulaError('#VALUE!', `${fnName} requiere 2 o 3 argumentos.`)
        }
        const cond = toBoolean(evaluateFormulaAst(node.args[0], scope))
        if (cond) {
          return evaluateFormulaAst(node.args[1], scope)
        }
        return node.args.length === 3 ? evaluateFormulaAst(node.args[2], scope) : false
      }

      if (fnName === 'IFERROR' || fnName === 'SI.ERROR') {
        if (node.args.length !== 2) {
          throw new FormulaError('#VALUE!', `${fnName} requiere exactamente 2 argumentos.`)
        }
        try {
          const val = evaluateFormulaAst(node.args[0], scope)
          if (typeof val === 'number' && !Number.isFinite(val)) {
            return evaluateFormulaAst(node.args[1], scope)
          }
          return val
        } catch (err) {
          if (err instanceof FormulaError) {
            return evaluateFormulaAst(node.args[1], scope)
          }
          throw err
        }
      }

      if (fnName === 'COALESCE') {
        if (node.args.length === 0) {
          throw new FormulaError('#VALUE!', 'COALESCE requiere al menos 1 argumento.')
        }
        for (const arg of node.args) {
          try {
            const val = evaluateFormulaAst(arg, scope)
            if (val !== '' && !(typeof val === 'number' && !Number.isFinite(val))) {
              return val
            }
          } catch (err) {
            if (err instanceof FormulaError) continue
            throw err
          }
        }
        return 0
      }

      const fn = EAGER_FUNCTIONS.get(fnName)
      if (!fn) {
        throw new FormulaError('#NAME?', `Función desconocida: "${node.name}".`)
      }
      const evaluatedArgs = node.args.map((arg) => evaluateFormulaAst(arg, scope))
      return fn(evaluatedArgs)
    }
  }
}

function compareValues(a: FormulaValue, b: FormulaValue): number {
  if (typeof a === 'string' && typeof b === 'string') {
    const la = a.toLowerCase()
    const lb = b.toLowerCase()
    return la < lb ? -1 : la > lb ? 1 : 0
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b ? 0 : a ? 1 : -1
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a < b ? -1 : a > b ? 1 : 0
  }
  // Excel cross-type equality: string !== number unless comparing equal strings
  if (typeof a === 'string' || typeof b === 'string') {
    const la = String(a).toLowerCase()
    const lb = String(b).toLowerCase()
    return la < lb ? -1 : la > lb ? 1 : 0
  }
  const na = toNumber(a, 'comparación')
  const nb = toNumber(b, 'comparación')
  return na < nb ? -1 : na > nb ? 1 : 0
}

// ── AST Introspection, Validation & Cell-Ref Rewriting ────────────────────────

export interface FormulaReferences {
  vars: Set<string>
  cellRefs: Set<string>
  rangeRefs: Set<string>
  functions: Set<string>
}

export function extractAstReferences(node: ASTNode): FormulaReferences {
  const vars = new Set<string>()
  const cellRefs = new Set<string>()
  const rangeRefs = new Set<string>()
  const functions = new Set<string>()

  const walk = (n: ASTNode): void => {
    switch (n.type) {
      case 'VarRef':
        vars.add(n.name)
        break
      case 'CellRef':
        cellRefs.add(n.fullRef)
        break
      case 'RangeRef':
        rangeRefs.add(n.fullRef)
        cellRefs.add(n.start.fullRef)
        cellRefs.add(n.end.fullRef)
        break
      case 'UnaryOp':
        walk(n.operand)
        break
      case 'BinaryOp':
        walk(n.left)
        walk(n.right)
        break
      case 'CallExpr':
        functions.add(n.name.toUpperCase())
        for (const arg of n.args) walk(arg)
        break
      default:
        break
    }
  }

  walk(node)
  return { vars, cellRefs, rangeRefs, functions }
}

/**
 * Extracts normalized cell references (e.g. ["B3", "B4", "B5", "A10"]) from an Excel formula string.
 * Strips '$' anchors and normalizes sheet prefixes.
 */
export function extractFormulaCellRefs(expression: string): string[] {
  const ast = parseExcelFormula(expression)
  const refs = extractAstReferences(ast)
  const out = new Set<string>()
  for (const r of refs.cellRefs) out.add(r)
  for (const rng of refs.rangeRefs) out.add(rng)
  return Array.from(out)
}

/**
 * Walks an AST and returns all unresolved CellRef / RangeRef strings.
 */
export function findUnresolvedCellRefs(ast: ASTNode): string[] {
  const refs = extractAstReferences(ast)
  return [...Array.from(refs.rangeRefs), ...Array.from(refs.cellRefs)]
}

function opPrecedence(op: BinaryOperator): number {
  switch (op) {
    case '=':
    case '<>':
    case '<':
    case '<=':
    case '>':
    case '>=':
      return 1
    case '&':
      return 2
    case '+':
    case '-':
      return 3
    case '*':
    case '/':
      return 4
    case '^':
      return 5
  }
}

function serializeAstNode(node: ASTNode, parentPrec: number = 0, isRightChild: boolean = false): string {
  switch (node.type) {
    case 'NumberLit':
      return String(node.value)
    case 'StringLit':
      return `"${node.value.replace(/"/g, '""')}"`
    case 'BoolLit':
      return node.value ? 'TRUE' : 'FALSE'
    case 'VarRef':
      return node.name
    case 'CellRef':
      return node.fullRef
    case 'RangeRef':
      return node.fullRef
    case 'UnaryOp': {
      if (node.op === '%') {
        const inner = serializeAstNode(node.operand, 6, false)
        return `${inner}%`
      }
      const inner = serializeAstNode(node.operand, 6, false)
      return `${node.op}${inner}`
    }
    case 'BinaryOp': {
      // Emit POWER(left, right) for Excel ^ operator so rewritten formulas match canonical form
      if (node.op === '^') {
        const l = serializeAstNode(node.left, 0, false)
        const r = serializeAstNode(node.right, 0, false)
        return `POWER(${l}, ${r})`
      }
      const prec = opPrecedence(node.op)
      const leftStr = serializeAstNode(node.left, prec, false)
      const rightStr = serializeAstNode(node.right, prec, true)
      const expr = `${leftStr} ${node.op} ${rightStr}`
      const needsParens =
        prec < parentPrec || (isRightChild && prec === parentPrec && (node.op === '-' || node.op === '/'))
      return needsParens ? `(${expr})` : expr
    }
    case 'CallExpr': {
      const argsStr = node.args.map((a) => serializeAstNode(a, 0, false)).join(', ')
      return `${node.name}(${argsStr})`
    }
  }
}

export interface RewriteFormulaResult {
  rewritten: string
  unresolvedRefs: string[]
}

/**
 * Rewrites Excel cell references inside a formula into canonical platform variable names
 * using a prototype-safe Map<cellRef, platformVar>. Returns the rewritten formula (prefixed with '=')
 * and any unresolved cell/range references.
 */
export function rewriteFormulaCellRefs(
  expression: string,
  cellToVarMap: ReadonlyMap<string, string>,
  defaultSheet?: string,
): RewriteFormulaResult {
  const ast = parseExcelFormula(expression)
  const unresolved = new Set<string>()

  const lookupMapping = (cell: CellRefNode): string | undefined => {
    const direct = cellToVarMap.get(cell.fullRef)
    if (direct) return direct
    const normFull = normalizeCellRef(cell.fullRef)
    if (cellToVarMap.has(normFull)) return cellToVarMap.get(normFull)
    if (cell.sheet && defaultSheet && cell.sheet === defaultSheet && cellToVarMap.has(cell.ref)) {
      return cellToVarMap.get(cell.ref)
    }
    if (!cell.sheet && defaultSheet) {
      const qualified = `${defaultSheet}!${cell.ref}`
      if (cellToVarMap.has(qualified)) return cellToVarMap.get(qualified)
    }
    if (cellToVarMap.has(cell.ref)) return cellToVarMap.get(cell.ref)
    return undefined
  }

  const transform = (node: ASTNode): ASTNode => {
    switch (node.type) {
      case 'CellRef': {
        const mapped = lookupMapping(node)
        if (mapped) {
          return { type: 'VarRef', name: mapped }
        }
        unresolved.add(node.fullRef)
        return node
      }
      case 'RangeRef': {
        const mapped =
          cellToVarMap.get(node.fullRef) ??
          (defaultSheet && !node.sheet ? cellToVarMap.get(`${defaultSheet}!${node.fullRef}`) : undefined)
        if (mapped) {
          return { type: 'VarRef', name: mapped }
        }
        unresolved.add(node.fullRef)
        return node
      }
      case 'UnaryOp':
        return { ...node, operand: transform(node.operand) }
      case 'BinaryOp':
        return { ...node, left: transform(node.left), right: transform(node.right) }
      case 'CallExpr':
        return { ...node, args: node.args.map(transform) }
      default:
        return node
    }
  }

  const transformed = transform(ast)
  return {
    rewritten: `=${serializeAstNode(transformed)}`,
    unresolvedRefs: Array.from(unresolved),
  }
}

// ── Compilation, Kahn Topological Sort & Per-Template Memoization ─────────────

export interface CompiledFormulaEntry {
  key: FormulaDefinicion['key']
  label: string
  unit: FormulaDefinicion['unit']
  expression: string
  ast: ASTNode
  dependencies: string[]
}

export interface CompiledTemplateProgram {
  ordered: CompiledFormulaEntry[]
  byKey: Map<FormulaDefinicion['key'], CompiledFormulaEntry>
}

export interface CompileFormulasOptions {
  templateId?: string
  allowCellRefs?: boolean
  validateIdentifiers?: boolean
  extraAllowedIdentifiers?: ReadonlySet<string>
}

const MAX_PROGRAM_CACHE_SIZE = 128
const COMPILED_PROGRAM_CACHE = new Map<string, CompiledTemplateProgram>()

export function clearCompiledFormulaCache(): void {
  COMPILED_PROGRAM_CACHE.clear()
}

/**
 * Compiles enabled formulas to typed ASTs, checks unknown functions / forbidden identifiers /
 * unresolved cell refs, and resolves dependency order via Kahn's topological sort
 * (mirroring lib/cascade-scheduler.ts). Rejects cycles with FormulaError('#CYCLE!').
 * Memoized by immutable templateId for < 1 ms 360-month evaluations.
 */
export function compileAndSortFormulas(
  formulas: readonly FormulaDefinicion[],
  options: CompileFormulasOptions = {},
): CompiledTemplateProgram {
  const {
    templateId,
    allowCellRefs = false,
    validateIdentifiers = true,
    extraAllowedIdentifiers,
  } = options

  if (templateId && COMPILED_PROGRAM_CACHE.has(templateId)) {
    return COMPILED_PROGRAM_CACHE.get(templateId)!
  }

  const enabled = formulas.filter((f) => f && f.enabled !== false)
  const entryMap = new Map<FormulaDefinicion['key'], CompiledFormulaEntry>()
  const formulaKeySet = new Set<string>(enabled.map((f) => f.key))

  for (const def of enabled) {
    const ast = parseExcelFormula(def.expression)
    const refs = extractAstReferences(ast)

    // Reject unknown functions at compile time
    for (const fn of refs.functions) {
      if (!isKnownExcelFunction(fn)) {
        throw new FormulaError('#NAME?', `Función desconocida "${fn}" en fórmula "${def.key}".`)
      }
    }

    // Reject unresolved CellRef / RangeRef nodes at save/compile time
    if (!allowCellRefs) {
      const unresolvedCells = [...Array.from(refs.rangeRefs), ...Array.from(refs.cellRefs)]
      if (unresolvedCells.length > 0) {
        throw new FormulaError(
          '#REF!',
          `La fórmula "${def.key}" contiene referencias de celda sin mapear: ${unresolvedCells.join(', ')}.`,
        )
      }
    }

    // Reject forbidden prototype identifiers & unknown platform variables
    for (const v of refs.vars) {
      if (FORBIDDEN_IDENTIFIERS.has(v)) {
        throw new FormulaError('#NAME?', `Identificador prohibido "${v}" en fórmula "${def.key}".`)
      }
      if (
        validateIdentifiers &&
        !isKnownPlatformIdentifier(v) &&
        !formulaKeySet.has(v) &&
        !(extraAllowedIdentifiers?.has(v) ?? false)
      ) {
        throw new FormulaError('#NAME?', `Variable desconocida "${v}" en fórmula "${def.key}".`)
      }
    }

    // Self-reference check
    if (refs.vars.has(def.key)) {
      throw new FormulaError(
        '#CYCLE!',
        `Referencia circular directa: la fórmula "${def.key}" depende de sí misma.`,
      )
    }

    const deps = Array.from(refs.vars).filter((v) => formulaKeySet.has(v))
    entryMap.set(def.key, {
      key: def.key,
      label: def.label,
      unit: def.unit,
      expression: def.expression,
      ast,
      dependencies: deps,
    })
  }

  // Kahn's topological sort (predecessors first)
  const inDegree = new Map<FormulaDefinicion['key'], number>()
  const adjList = new Map<FormulaDefinicion['key'], FormulaDefinicion['key'][]>()

  for (const key of entryMap.keys()) {
    inDegree.set(key, 0)
    adjList.set(key, [])
  }

  for (const [key, entry] of entryMap) {
    for (const dep of entry.dependencies) {
      const depKey = dep as FormulaDefinicion['key']
      if (entryMap.has(depKey)) {
        adjList.get(depKey)!.push(key)
        inDegree.set(key, (inDegree.get(key) ?? 0) + 1)
      }
    }
  }

  const queue: FormulaDefinicion['key'][] = []
  for (const [key, deg] of inDegree) {
    if (deg === 0) queue.push(key)
  }

  const ordered: CompiledFormulaEntry[] = []
  while (queue.length > 0) {
    const currentKey = queue.shift()!
    ordered.push(entryMap.get(currentKey)!)
    for (const dependentKey of adjList.get(currentKey) ?? []) {
      const nextDeg = (inDegree.get(dependentKey) ?? 1) - 1
      inDegree.set(dependentKey, nextDeg)
      if (nextDeg === 0) {
        queue.push(dependentKey)
      }
    }
  }

  if (ordered.length < entryMap.size) {
    const cycleKeys = Array.from(entryMap.keys()).filter((k) => (inDegree.get(k) ?? 0) > 0)
    throw new FormulaError(
      '#CYCLE!',
      `Dependencia circular detectada entre las fórmulas: ${cycleKeys.join(', ')}.`,
    )
  }

  const program: CompiledTemplateProgram = {
    ordered,
    byKey: entryMap,
  }

  if (templateId) {
    if (COMPILED_PROGRAM_CACHE.size >= MAX_PROGRAM_CACHE_SIZE) {
      const firstKey = COMPILED_PROGRAM_CACHE.keys().next().value
      if (firstKey !== undefined) COMPILED_PROGRAM_CACHE.delete(firstKey)
    }
    COMPILED_PROGRAM_CACHE.set(templateId, program)
  }

  return program
}

/**
 * Evaluates a compiled formula program in topological order, writing each formula's numeric output
 * back into the mutable Map scope so downstream formulas can consume it with zero allocations.
 */
export function evaluateCompiledProgram(
  program: CompiledTemplateProgram,
  scope: Map<string, FormulaValue>,
): void {
  for (let i = 0; i < program.ordered.length; i++) {
    const entry = program.ordered[i]
    const raw = evaluateFormulaAst(entry.ast, scope)
    const num = toNumber(raw, entry.key)
    scope.set(entry.key, num)
  }
}

/**
 * Convenience helper to parse & evaluate a single Excel expression against a Map scope.
 */
export function evaluateExcelExpression(
  expression: string,
  scope: ReadonlyMap<string, FormulaValue>,
): FormulaValue {
  const ast = parseExcelFormula(expression)
  return evaluateFormulaAst(ast, scope)
}
