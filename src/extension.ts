import * as vscode from 'vscode'

// ── clause keywords longest-first so "ORDER BY" wins over "ORDER" ─────────────
const CLAUSES = [
  'ORDER BY', 'GROUP BY', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
  'FULL OUTER JOIN', 'FULL JOIN', 'CROSS JOIN', 'INSERT INTO', 'DELETE FROM',
  'UNION ALL',
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'HAVING',
  'LIMIT', 'OFFSET', 'SET', 'UPDATE', 'DELETE', 'INSERT',
  'VALUES', 'WITH', 'UNION', 'INTERSECT', 'EXCEPT', 'RETURNING',
]

// ── all sql keywords to uppercase (never touch string literal contents) ────────
const KEYWORDS = [
  'SELECT','FROM','WHERE','JOIN','LEFT','RIGHT','INNER','OUTER','FULL',
  'CROSS','ON','AND','OR','NOT','IN','IS','NULL','AS','INSERT','INTO',
  'VALUES','UPDATE','SET','DELETE','CREATE','TABLE','DROP','ALTER','INDEX',
  'VIEW','GROUP','BY','ORDER','HAVING','UNION','ALL',
  'DISTINCT','CASE','WHEN','THEN','ELSE','END','EXISTS','BETWEEN','LIKE',
  'ASC','DESC','WITH','COUNT','SUM','AVG','MIN','MAX','COALESCE','NULLIF',
  'CAST','NOW','INTERVAL','RETURNING', 'CURRENT_DATE', 'CURRENT_TIMESTAMP',
]

const CLAUSE_RE = new RegExp(
  `^(${CLAUSES.map(k => k.replace(/ /g, '\\s+')).join('|')})(?=\\s|$)`,
  'i'
)

const STMT_START_RE = /^\s*(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|DROP|ALTER|TRUNCATE)\b/i
const STMT_CLOSE_RE = /\b(WHERE|LIMIT|OFFSET|RETURNING|VALUES|HAVING)\b/i

// ─── activation ───────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlFormatter.formatQuery', async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) return

      const doc        = editor.document
      const selections = editor.selections

      // no selection → format whole file
      if (selections.length === 1 && selections[0].isEmpty) {
        const raw = doc.getText()
        if (!isSql(raw.trim())) {
          vscode.window.showWarningMessage('No SQL found in file.')
          return
        }
        try {
          const result = formatMultiple(raw)
          await editor.edit(eb =>
            eb.replace(new vscode.Range(doc.positionAt(0), doc.positionAt(raw.length)), result)
          )
          vscode.window.showInformationMessage('Formatted.')
        } catch (e) {
          vscode.window.showErrorMessage(`SQL formatting failed: ${e}`)
        }
        return
      }

      // one or more selections (multi-cursor) — reverse order to keep offsets stable
      const sorted = [...selections]
        .filter(s => !s.isEmpty)
        .sort((a, b) => b.start.compareTo(a.start))

      if (sorted.length === 0) {
        vscode.window.showWarningMessage('No text selected.')
        return
      }

      let formattedCount = 0
      let skippedCount   = 0

      try {
        await editor.edit(eb => {
          for (const sel of sorted) {
            const raw = doc.getText(sel)

            // check for delimited SQL blocks inside the selection
            const delimited = extractDelimitedBlocks(raw)
            if (delimited.length > 0) {
              let rebuilt = raw
              for (let i = delimited.length - 1; i >= 0; i--) {
                const b         = delimited[i]
                const formatted = formatMultiple(b.sql)
                rebuilt         = rebuilt.slice(0, b.start) + formatted + rebuilt.slice(b.end)
              }
              eb.replace(sel, rebuilt)
              formattedCount += delimited.length
              continue
            }

            if (!isSql(raw.trim())) { skippedCount++; continue }

            eb.replace(sel, formatMultiple(raw))
            formattedCount += splitMultipleQueries(raw).length
          }
        })

        if (formattedCount === 0 && skippedCount > 0) {
          vscode.window.showWarningMessage('Selected text does not appear to be SQL.')
        } else {
          vscode.window.showInformationMessage(
            formattedCount > 1
              ? `Formatted ${formattedCount} queries across ${sorted.length} selection(s).`
              : 'Formatted.'
          )
        }
      } catch (e) {
        vscode.window.showErrorMessage(`SQL formatting failed: ${e}`)
      }
    })
  )

  // built-in format document — .sql files only
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('sql', {
      provideDocumentFormattingEdits(doc) {
        const text  = doc.getText()
        const range = new vscode.Range(doc.positionAt(0), doc.positionAt(text.length))
        return [vscode.TextEdit.replace(range, formatMultiple(text))]
      },
    })
  )
}

// ─── format: split → format each → rejoin ─────────────────────────────────────

function formatMultiple(text: string): string {
  return splitMultipleQueries(text)
    .map(q => formatSql(q.trim()))
    .join('\n\n')
}

// ─── core format pipeline — NO sql-formatter, token-safe ──────────────────────
//
//  Three steps only:
//  1. uppercaseKeywords  — uppercase SQL keywords, never touch string values
//  2. normaliseWhitespace — collapse tabs/multi-spaces to single space, fix
//                           operator spacing, normalise commas — NO token removal
//  3. alignClauses       — put every clause keyword at col 0 padded to COL,
//                           every value/continuation indented to COL

function formatSql(sql: string): string {
  const step1 = uppercaseKeywords(sql)
  const step2 = normaliseWhitespace(step1)
  const step3 = alignClauses(step2)
  return step3
    .split('\n')
    .map(l => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ─── step 1: uppercase keywords, skip single-quoted string literals ────────────

function uppercaseKeywords(sql: string): string {
  const re = new RegExp(`\\b(${KEYWORDS.join('|')})\\b`, 'gi')
  // split on 'quoted strings' — odd-index parts are string values, leave them alone
  return sql
    .split(/('(?:[^'\\]|\\.)*')/g)
    .map((part, i) => i % 2 === 0 ? part.replace(re, m => m.toUpperCase()) : part)
    .join('')
}

// ─── step 2: normalise whitespace — never removes tokens ──────────────────────
//
//  - collapse tabs + multi-spaces to single space (outside strings)
//  - ensure single space around = != <> < > <= >= + - / %
//  - ensure space after comma, no space before comma
//  - trim each line
//  - collapse 3+ blank lines to 1

function normaliseWhitespace(sql: string): string {
  // work part by part to skip string literals
  const parts = sql.split(/('(?:[^'\\]|\\.)*')/g)
  const processed = parts.map((part, i) => {
    if (i % 2 !== 0) return part  // string literal — untouched

    return part
      .replace(/\t/g, ' ')                         // tabs → space
      .replace(/[ ]{2,}/g, ' ')                    // multi-space → single
      .replace(/[ ]*,[ ]*/g, ', ')                 // normalise commas
      .replace(/[ ]*=[ ]*/g, ' = ')                // spaces around =
      .replace(/[ ]*!=[ ]*/g, ' != ')
      .replace(/[ ]*<>[ ]*/g, ' <> ')
      .replace(/[ ]*<=[ ]*/g, ' <= ')
      .replace(/[ ]*>=[ ]*/g, ' >= ')
      .replace(/[ ]*<[ ]*/g, ' < ')
      .replace(/[ ]*>[ ]*/g, ' > ')
  })

  return processed
    .join('')
    .split('\n')
    .map(l => l.trim())
    .filter((l, i, arr) => {
      // collapse consecutive blank lines to at most one
      if (l === '') return i === 0 || arr[i - 1] !== ''
      return true
    })
    .join('\n')
}

// ─── step 3: align every clause to one vertical column ────────────────────────
//
//  Rules:
//  - only lines at paren-depth 0 are treated as clause lines
//  - COL = longest clause keyword in THIS query + 2
//  - clause keyword → right-padded to COL, content follows on same line
//  - continuation lines (column lists, conditions) → indented to COL
//  - lines inside (...) subqueries → indented to subqueryIndent, NOT re-aligned
//
//  Result:
//  UPDATE    loans.borrowers_loan_emis
//  SET       due_date = COALESCE(?, due_date),
//            total_amount = COALESCE(NULLIF(?, '')::numeric, total_amount),
//            principal_amount = COALESCE(NULLIF(?, '')::numeric, principal_amount),
//            ...
//  WHERE     loan_id = ?
//    AND     emi_number = ?

function alignClauses(sql: string): string {
  // first break any single-line SQL into per-clause lines
  const expanded = expandToClauses(sql)

  const lines = expanded
    .split('\n')
    .map(l => l.trimStart())
    .filter(l => l.length > 0)

  // pass 1: measure longest top-level clause keyword
  let maxKw = 0, depth = 0
  for (const line of lines) {
    if (depth === 0) {
      const m = line.match(CLAUSE_RE)
      if (m) maxKw = Math.max(maxKw, m[1].replace(/\s+/g, ' ').length)
    }
    depth = Math.max(0, depth + countParenDelta(line))
  }

  const COL = maxKw + 2

  // pass 2: rebuild with alignment
  const out: string[] = []
  depth = 0
  let subqueryIndent = 0

  for (const line of lines) {
    if (depth === 0) {
      const m = line.match(CLAUSE_RE)
      if (m) {
        const kw   = m[1].replace(/\s+/g, ' ').toUpperCase()
        const rest = line.slice(m[0].length).trimStart()
        const pad  = ' '.repeat(COL - kw.length)
        depth          = Math.max(0, countParenDelta(rest))
        subqueryIndent = COL + 2
        out.push(rest ? `${kw}${pad}${rest}` : kw)
      } else {
        depth = Math.max(0, depth + countParenDelta(line))
        out.push(`${' '.repeat(COL)}${line}`)
      }
    } else {
      // inside subquery/paren block — preserve as-is, shift to subqueryIndent
      out.push(`${' '.repeat(subqueryIndent)}${line}`)
      depth = Math.max(0, depth + countParenDelta(line))
      if (depth === 0) subqueryIndent = 0
    }
  }

  return out.join('\n')
}

// ─── expand single-line SQL into one-clause-per-line ──────────────────────────
//
//  Injects a newline before each top-level clause keyword when it appears
//  mid-line (not inside parens, not inside string literals).
//  This handles queries like:
//    SELECT * FROM users WHERE id = 1 ORDER BY id
//  → each clause starts on its own line before alignClauses runs.

function expandToClauses(sql: string): string {
  // sort longest-first so "ORDER BY" is injected before "ORDER"
  const sorted = [...CLAUSES].sort((a, b) => b.length - a.length)
  const kwRe   = new RegExp(`\\b(${sorted.map(k => k.replace(/ /g, '\\s+')).join('|')})\\b`, 'gi')

  // tokenise: split preserving string literals and paren groups
  // We inject newlines only when depth === 0 and not inside a string
  const result: string[] = []
  let   depth  = 0
  let   inStr  = false
  let   buf    = ''

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]

    if (c === "'" && !inStr) { inStr = true;  buf += c; continue }
    if (c === "'" &&  inStr) { inStr = false; buf += c; continue }
    if (inStr) { buf += c; continue }

    if (c === '(') { depth++; buf += c; continue }
    if (c === ')') { depth--; buf += c; continue }

    buf += c
  }

  // now do keyword injection on the full string, respecting string literals
  // by splitting on them first
  const parts = sql.split(/('(?:[^'\\]|\\.)*')/g)
  const injected = parts.map((part, idx) => {
    if (idx % 2 !== 0) return part  // string literal — untouched

    // track paren depth across parts
    let d   = 0
    let out = ''
    let j   = 0

    while (j < part.length) {
      // check for clause keyword at current position when depth === 0
      if (d === 0) {
        let matched = false
        for (const kw of sorted) {
          const re = new RegExp(`^${kw.replace(/ /g, '\\s+')}(?=\\s|$)`, 'i')
          const m  = part.slice(j).match(re)
          if (m) {
            // inject newline before keyword if not at start of string
            if (out.trimEnd().length > 0) out = out.trimEnd() + '\n'
            out    += m[0]
            j      += m[0].length
            matched = true
            break
          }
        }
        if (matched) continue
      }

      const c = part[j]
      if (c === '(') d++
      if (c === ')') d--
      out += c
      j++
    }

    return out
  })

  return injected.join('')
}

// ─── split multiple SQL queries ───────────────────────────────────────────────

function splitMultipleQueries(text: string): string[] {
  const lines  = text.split('\n')
  const chunks: string[][] = [[]]
  let   depth  = 0

  for (let i = 0; i < lines.length; i++) {
    const line    = lines[i]
    const trimmed = line.trim()

    // blank line = separator only when current chunk is a complete statement
    if (trimmed === '' && depth === 0) {
      const current     = chunks[chunks.length - 1]
      const currentText = current.join('\n')
      const isComplete  = (
        currentText.trimEnd().endsWith(';') ||
        STMT_CLOSE_RE.test(currentText)
      )
      if (current.length > 0 && isComplete) chunks.push([])
      continue
    }

    // semicolon = hard statement end
    if (trimmed.endsWith(';') && depth === 0) {
      chunks[chunks.length - 1].push(line)
      chunks.push([])
      depth = 0
      continue
    }

    // new statement keyword after a complete chunk = new query
    const currentChunk = chunks[chunks.length - 1]
    const currentText  = currentChunk.join('\n')
    if (
      depth === 0 &&
      currentChunk.length > 0 &&
      STMT_START_RE.test(trimmed) &&
      (STMT_CLOSE_RE.test(currentText) || currentText.trimEnd().endsWith(';'))
    ) {
      chunks.push([])
    }

    chunks[chunks.length - 1].push(line)
    depth = Math.max(0, depth + countParenDelta(line))
  }

  return chunks
    .map(c => c.join('\n').trim())
    .filter(c => c.length > 0)
}

// ─── extract SQL from delimited strings ───────────────────────────────────────

interface DelimitedBlock { sql: string; start: number; end: number }

function extractDelimitedBlocks(text: string): DelimitedBlock[] {
  const blocks: DelimitedBlock[] = []

  // backtick template literals (skip ${...})
  let i = 0
  while (i < text.length) {
    if (text[i] !== '`') { i++; continue }
    const start = i + 1; i++
    let d = 0
    while (i < text.length) {
      if (text[i] === '$' && text[i+1] === '{') { d++; i += 2; continue }
      if (text[i] === '}' && d > 0)              { d--; i++;    continue }
      if (text[i] === '`' && d === 0)            { break }
      i++
    }
    const sql = text.slice(start, i).trim()
    if (isSql(sql)) blocks.push({ sql, start, end: i })
    i++
  }

  // double-quoted strings
  const dqRe = /"((?:[^"\\]|\\.)*)"/g
  let m: RegExpExecArray | null
  while ((m = dqRe.exec(text)) !== null) {
    const sql = m[1].trim()
    if (isSql(sql)) blocks.push({ sql, start: m.index+1, end: m.index+1+m[1].length })
  }

  // single-quoted strings (only if full query, not a value literal)
  const sqRe = /'((?:[^'\\]|\\.)*)'/g
  while ((m = sqRe.exec(text)) !== null) {
    const sql = m[1].trim()
    if (isSql(sql)) blocks.push({ sql, start: m.index+1, end: m.index+1+m[1].length })
  }

  return blocks
    .sort((a, b) => a.start - b.start)
    .filter((b, idx, arr) => idx === 0 || b.start >= arr[idx-1].end)
}

// ─── paren depth delta for a line (skips string literals) ─────────────────────

function countParenDelta(line: string): number {
  let depth = 0, inStr = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === "'" && !inStr) { inStr = true;  continue }
    if (c === "'" &&  inStr) { inStr = false; continue }
    if (inStr) continue
    if (c === '(') depth++
    if (c === ')') depth--
  }
  return depth
}

// ─── sql detection ────────────────────────────────────────────────────────────
//
//  Accepts:
//  - complete statements:  SELECT...FROM, INSERT INTO, UPDATE...SET, DELETE FROM
//  - partial fragments:    SELECT col list (no FROM yet), WHERE block, AND/OR block
//  - function call SQL:    schema.function(?, ?)
//  - CASE blocks, ORDER BY, LIMIT/OFFSET standalone
//  - anything with 2+ SQL clause keywords regardless of order

function isSql(text: string): boolean {
  const t = text.trim()
  if (t.length < 3) return false

  // full statement patterns
  if (/\b(select\b[\s\S]+?\bfrom\b|insert\s+into\b|update\b[\s\S]+?\bset\b|delete\s+from\b|create\s+table\b)/i.test(t)) return true

  // partial fragment: starts with a clause keyword
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|WITH|WHERE|SET|VALUES|ORDER\s+BY|GROUP\s+BY|HAVING|LIMIT|OFFSET|AND|OR|CASE|RETURNING)\b/i.test(t)) return true

  // contains 2 or more distinct clause keywords = likely SQL
  const clauseKws = ['SELECT','FROM','WHERE','JOIN','ON','GROUP BY','ORDER BY',
    'HAVING','LIMIT','OFFSET','SET','UPDATE','INSERT','VALUES','DELETE','WITH',
    'RETURNING','AND','OR','CASE','WHEN','THEN','END']
  const lower = t.toLowerCase()
  const matches = clauseKws.filter(k => {
    const re = new RegExp('\\b' + k.toLowerCase().replace(/ /g, '\\s+') + '\\b')
    return re.test(lower)
  })
  if (matches.length >= 2) return true

  // SQL function call pattern: schema.function(...) or function(...)
  if (/\b\w+\.\w+\s*\(/.test(t) && /[?,]/.test(t)) return true

  return false
}

export function deactivate() {}