import * as vscode from "vscode";
import { format, SqlLanguage } from "sql-formatter";

// longest-first so "ORDER BY" always wins over "ORDER" or "BY"
const CLAUSES = [
  "ORDER BY",
  "GROUP BY",
  "LEFT JOIN",
  "RIGHT JOIN",
  "INNER JOIN",
  "FULL OUTER JOIN",
  "FULL JOIN",
  "CROSS JOIN",
  "INSERT INTO",
  "DELETE FROM",
  "UNION ALL",
  "SELECT",
  "FROM",
  "WHERE",
  "JOIN",
  "ON",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "SET",
  "UPDATE",
  "DELETE",
  "INSERT",
  "VALUES",
  "WITH",
  "UNION",
  "INTERSECT",
  "EXCEPT",
  "RETURNING",
];

const KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "JOIN",
  "LEFT",
  "RIGHT",
  "INNER",
  "OUTER",
  "FULL",
  "CROSS",
  "ON",
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS",
  "NULL",
  "AS",
  "INSERT",
  "INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "CREATE",
  "TABLE",
  "DROP",
  "ALTER",
  "INDEX",
  "VIEW",
  "GROUP",
  "BY",
  "ORDER",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "UNION",
  "ALL",
  "DISTINCT",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "EXISTS",
  "BETWEEN",
  "LIKE",
  "ASC",
  "DESC",
  "WITH",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "COALESCE",
  "NULLIF",
  "CAST",
  "NOW",
  "INTERVAL",
  "RETURNING",
];

const CLAUSE_RE = new RegExp(
  `^(${CLAUSES.map((k) => k.replace(/ /g, "\\s+")).join("|")})(?=\\s|$)`,
  "i",
);

// statement-starting keywords — used to detect where a new query begins
const STMT_START_RE =
  /^\s*(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|WHERE|VALUES|DROP|ALTER|TRUNCATE)\b/i;

// ─── activation 

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlFormatter.formatQuery', async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) return
 
      const doc     = editor.document
      const dialect = (
        vscode.workspace.getConfiguration('sqlFormatter').get<string>('dialect') ?? 'postgresql'
      ) as SqlLanguage
 
      // editor.selections contains ALL active selections —
      // one for a normal selection, many for multi-cursor (Ctrl+D / Ctrl+Click)
      const selections = editor.selections
 
      // ── no selection at all → format entire document ──────────────────────
      if (selections.length === 1 && selections[0].isEmpty) {
        const raw = doc.getText()
        if (!isSql(raw.trim())) {
          vscode.window.showWarningMessage('No SQL found in file.')
          return
        }
        try {
          const result = formatMultiple(raw, dialect)
          await editor.edit(eb =>
            eb.replace(new vscode.Range(doc.positionAt(0), doc.positionAt(raw.length)), result)
          )
          vscode.window.showInformationMessage('Formatted.')
        } catch (e) {
          vscode.window.showErrorMessage(`SQL formatting failed: ${e}`)
        }
        return
      }
 
      // ── one or more selections (including multi-cursor) ───────────────────
      // Sort selections in REVERSE document order so replacing one range
      // doesn't shift the offsets of selections that come before it.
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
        // single edit builder — applies ALL replacements atomically
        await editor.edit(eb => {
          for (const sel of sorted) {
            const raw = doc.getText(sel)
 
            // check for delimited blocks inside this selection (backtick / " / ')
            const delimited = extractDelimitedBlocks(raw)
            if (delimited.length > 0) {
              let rebuilt = raw
              for (let i = delimited.length - 1; i >= 0; i--) {
                const b         = delimited[i]
                const formatted = formatMultiple(b.sql, dialect)
                rebuilt         = rebuilt.slice(0, b.start) + formatted + rebuilt.slice(b.end)
              }
              eb.replace(sel, rebuilt)
              formattedCount += delimited.length
              continue
            }
 
            // plain SQL text selected directly
            if (!isSql(raw.trim())) {
              skippedCount++
              continue
            }
 
            eb.replace(sel, formatMultiple(raw, dialect))
            formattedCount += splitMultipleQueries(raw).length
          }
        })
 
        // status message
        if (formattedCount === 0 && skippedCount > 0) {
          vscode.window.showWarningMessage('Selected text does not appear to be SQL.')
        } else {
          const msg = formattedCount > 1
            ? `Formatted ${formattedCount} queries across ${sorted.length} selection(s).`
            : 'Formatted.'
          vscode.window.showInformationMessage(msg)
        }
      } catch (e) {
        vscode.window.showErrorMessage(`SQL formatting failed: ${e}`)
      }
    })
  )
 
  // built-in format document — .sql files
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('sql', {
      provideDocumentFormattingEdits(doc) {
        const dialect = vscode.workspace
          .getConfiguration('sqlFormatter').get<string>('dialect') as SqlLanguage
        const text  = doc.getText()
        const range = new vscode.Range(doc.positionAt(0), doc.positionAt(text.length))
        return [vscode.TextEdit.replace(range, formatMultiple(text, dialect))]
      },
    })
  )
}


function formatMultiple(text: string, dialect: SqlLanguage): string {
  const queries = splitMultipleQueries(text);
  return queries.map((q) => formatSql(q.trim(), dialect)).join("\n\n");
}

function splitMultipleQueries(text: string): string[] {
  const lines = text.split("\n");
  const chunks: string[][] = [[]];
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // blank line at depth 0 = separator
    if (trimmed === "" && depth === 0) {
      if (chunks[chunks.length - 1].length > 0) chunks.push([]);
      continue;
    }

    // semicolon at end of line at depth 0 = end of statement
    if (trimmed.endsWith(";") && depth === 0) {
      chunks[chunks.length - 1].push(line);
      chunks.push([]);
      depth = 0;
      continue;
    }

    // new statement keyword at depth 0, after we already have content = new chunk
    const currentChunk = chunks[chunks.length - 1];
    if (
      depth === 0 &&
      currentChunk.length > 0 &&
      STMT_START_RE.test(trimmed) &&
      // make sure current chunk actually has SQL (not just blank lines)
      currentChunk.some((l) => l.trim().length > 0)
    ) {
      chunks.push([]);
    }

    chunks[chunks.length - 1].push(line);

    // track paren depth so we don't split on semicolons/keywords inside subqueries
    depth = Math.max(0, depth + countParenDelta(line));
  }

  return chunks
    .map((c) => c.join("\n").trim())
    .filter((c) => c.length > 0 && isSql(c));
}

//  extract SQL from template literals / quoted strings 

interface DelimitedBlock {
  sql: string;
  start: number;
  end: number;
}

function extractDelimitedBlocks(text: string): DelimitedBlock[] {
  const blocks: DelimitedBlock[] = [];

  // backtick template literals  `...`
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "`") {
      i++;
      continue;
    }
    const start = i + 1;
    i++;
    let depth = 0;
    while (i < text.length) {
      if (text[i] === "$" && text[i + 1] === "{") {
        depth++;
        i += 2;
        continue;
      }
      if (text[i] === "}" && depth > 0) {
        depth--;
        i++;
        continue;
      }
      if (text[i] === "`" && depth === 0) {
        break;
      }
      i++;
    }
    const sql = text.slice(start, i).trim();
    if (isSql(sql)) blocks.push({ sql, start, end: i });
    i++;
  }

  // ── double-quoted strings  "..." 
  const dqRe = /"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = dqRe.exec(text)) !== null) {
    const sql = m[1].trim();
    if (isSql(sql))
      blocks.push({ sql, start: m.index + 1, end: m.index + 1 + m[1].length });
  }

  // ── single-quoted strings  '...'
  const sqRe = /'((?:[^'\\]|\\.)*)'/g;
  while ((m = sqRe.exec(text)) !== null) {
    const sql = m[1].trim();
    if (isSql(sql))
      blocks.push({ sql, start: m.index + 1, end: m.index + 1 + m[1].length });
  }

  return blocks
    .sort((a, b) => a.start - b.start)
    .filter((b, idx, arr) => idx === 0 || b.start >= arr[idx - 1].end);
}

// format single SQL  

function formatSql(sql: string, dialect: SqlLanguage): string {
  const base = format(sql.trim(), {
    language: dialect,
    keywordCase: "upper",
    indentStyle: "standard",
    logicalOperatorNewline: "before",
    linesBetweenQueries: 1,
    tabWidth: 2,
    expressionWidth: 80,
    denseOperators: true,
  });

  return alignClauses(uppercaseKeywords(base))
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── uppercase keywords, skip string literals

function uppercaseKeywords(sql: string): string {
  const re = new RegExp(`\\b(${KEYWORDS.join("|")})\\b`, "gi");
  return sql
    .split(/('(?:[^'\\]|\\.)*')/g)
    .map((part, i) =>
      i % 2 === 0 ? part.replace(re, (m) => m.toUpperCase()) : part,
    )
    .join("");
}

function alignClauses(sql: string): string {
  const lines = sql
    .split("\n")
    .map((l) => l.trimStart())
    .filter((l) => l.length > 0);

  let maxKw = 0,
    depth = 0;
  for (const line of lines) {
    if (depth === 0) {
      const m = line.match(CLAUSE_RE);
      if (m) maxKw = Math.max(maxKw, m[1].replace(/\s+/g, " ").length);
    }
    depth = Math.max(0, depth + countParenDelta(line));
  }

  const COL = maxKw + 2; 

  // rebuild
  const out: string[] = [];
  depth = 0;
  let subqueryIndent = 0;

  for (const line of lines) {
    if (depth === 0) {
      const m = line.match(CLAUSE_RE);
      if (m) {
        const kw = m[1].replace(/\s+/g, " ").toUpperCase();
        const rest = line.slice(m[0].length).trimStart();
        const pad = " ".repeat(COL - kw.length);
        depth = Math.max(0, depth + countParenDelta(rest));
        subqueryIndent = COL + 2;
        out.push(rest ? `${kw}${pad}${rest}` : kw);
      } else {
        depth = Math.max(0, depth + countParenDelta(line));
        out.push(`${" ".repeat(COL)}${line}`);
      }
    } else {
      out.push(`${" ".repeat(subqueryIndent)}${line}`);
      depth = Math.max(0, depth + countParenDelta(line));
      if (depth === 0) subqueryIndent = 0;
    }
  }

  return out.join("\n");
}

function countParenDelta(line: string): number {
  let depth = 0,
    inStr = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inStr) {
      inStr = true;
      continue;
    }
    if (c === "'" && inStr) {
      inStr = false;
      continue;
    }
    if (inStr) continue;
    if (c === "(") depth++;
    if (c === ")") depth--;
  }
  return depth;
}

// sql detection

function isSql(text: string): boolean {
  return /\b(select\b[\s\S]+?\bfrom\b|insert\b|insert\b|values+into\b|update\b[\s\S]+?\bset\b|delete\s+from\b|create\s+table\b)/i.test(
    text.trim(),
  );
}

export function deactivate() {}
