import * as vscode from 'vscode'
import { format, SqlLanguage } from 'sql-formatter'

export function activate(context: vscode.ExtensionContext) {
  console.log('Universal SQL Formatter activated')

  const formatCommand = vscode.commands.registerCommand(
    "sqlFormatter.formatQuery",
    async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) {
        vscode.window.showErrorMessage('No active editor found')
        return
      }

      const document = editor.document
      const selection = editor.selection

      let text = document.getText(selection)

      if (!text) {
        text = document.getText()
      }

      if (!looksLikeSQL(text)) {
        vscode.window.showWarningMessage(
          'Selected text does not appear to be SQL query. Please select a valid SQL statement to format.'
        )
        return
      }

      const config = vscode.workspace.getConfiguration('sqlFormatter')
      const dialect = (config.get<string>('dialect') ||
        'postgresql') as SqlLanguage

      let formatted = ''

      try {
        formatted = prettifySQL(text, dialect)
      } catch (err) {
        vscode.window.showErrorMessage('SQL formatting failed')
        return
      }

      await editor.edit(editBuilder => {
        const selections = editor.selections

        selections.forEach(sel => {
          let text = document.getText(sel)

          if (!text.trim()) return

          const formatted = prettifySQL(text, dialect)
          const formattedText = postBeautify(formatted)

          editBuilder.replace(sel, formattedText)
        })
      })
    }
  )

  context.subscriptions.push(formatCommand)

  // FORMAT DOCUMENT (.sql files)
  const sqlFormatter = vscode.languages.registerDocumentFormattingEditProvider(
    'sql',
    {
      provideDocumentFormattingEdits(document) {
        const config = vscode.workspace.getConfiguration('sqlFormatter')
        const dialect = config.get('dialect') as SqlLanguage;

        const text = document.getText()

        const formatted = postBeautify(prettifySQL(text, dialect))

        const range = new vscode.Range(
          document.positionAt(0),
          document.positionAt(text.length)
        )

        return [vscode.TextEdit.replace(range, formatted)]
      }
    }
  )

  context.subscriptions.push(sqlFormatter)
}


const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER",
  "FULL", "CROSS", "ON", "AND", "OR", "NOT", "IN", "IS", "NULL", "AS",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE", "TABLE",
  "DROP", "ALTER", "INDEX", "VIEW", "GROUP", "BY", "ORDER", "HAVING",
  "LIMIT", "OFFSET", "UNION", "ALL", "DISTINCT", "CASE", "WHEN", "THEN",
  "ELSE", "END", "EXISTS", "BETWEEN", "LIKE", "ASC", "DESC", "WITH",
  "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF", "CAST",
  "NOW", "INTERVAL",
];

function uppercaseSQL(sql: string): string {
  const sorted = [...SQL_KEYWORDS].sort((a, b) => b.length - a.length);

  const pattern = new RegExp(
    `\\b(${sorted.join("|")})\\b`,
    "gi"
  );

  const parts = sql.split(/('(?:[^'\\]|\\.)*')/g);

  return parts
    .map((part, i) =>
      i % 2 === 0 ? part.replace(pattern, (m) => m.toUpperCase()) : part
    )
    .join("");
}

function alignColumns(sql: string): string {
  const lines = sql.split("\n");
  const result = [...lines];
  let inSelect = false;
  let blockStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const upper = lines[i].trim().toUpperCase();

    if (/^SELECT\b/.test(upper)) {
      inSelect = true;
      blockStart = i + 1;
      continue;
    }

    if (inSelect && /^(FROM|WHERE|GROUP|ORDER|HAVING|LIMIT|UNION|;)\b/.test(upper)) {
      applyAlignment(result, blockStart, i);
      inSelect = false;
      blockStart = -1;
    }
  }

  if (inSelect && blockStart > -1) {
    applyAlignment(result, blockStart, lines.length);
  }

  return result.join("\n");
}

function applyAlignment(lines: string[], start: number, end: number): void {
  const indices: number[] = [];
  const entries: { indent: string; expr: string; alias: string; tail: string }[] = [];

  for (let i = start; i < end; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("--")) continue;

    const m = line.match(
      /^(\s*)([\w."*()\[\]]+(?:\s*\.\s*[\w."*()\[\]]+)*)\s+(AS\s+\w+)(,?)(\s*--.*)?$/i
    );
    if (m) {
      indices.push(i);
      entries.push({
        indent: m[1],
        expr:   m[2],
        alias:  m[3],
        tail:   (m[4] ?? "") + (m[5] ?? ""),
      });
    }
  }

  if (entries.length < 2) return; // Nothing to align

  const maxLen = Math.max(...entries.map((e) => e.expr.length));

  entries.forEach((e, idx) => {
    const pad = " ".repeat(maxLen - e.expr.length + 1);
    lines[indices[idx]] = `${e.indent}${e.expr}${pad}${e.alias}${e.tail}`;
  });
}




  //  Aligns a SQL block so the leading clause keyword (SELECT, FROM, WHERE, etc.)
  //  sits at column 0 and all subsequent clause keywords align to the same column.

// Top-level clause keywords that should start at column 0
const CLAUSE_KEYWORDS = [
  "SELECT", "FROM", "WHERE",
  "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL JOIN", "CROSS JOIN", "JOIN",
  "ON",
  "GROUP BY", "ORDER BY", "HAVING",
  "LIMIT", "OFFSET",
  "UNION", "UNION ALL", "INTERSECT", "EXCEPT",
  "INSERT INTO", "INSERT",
  "VALUES",
  "UPDATE", "SET",
  "DELETE FROM", "DELETE",
  "WITH",
  "RETURNING",
];

function alignClauses(sql: string): string {
  // ── Step 1: strip ALL leading whitespace from every line ──────────────────
  const stripped = sql
    .split("\n")
    .map((l) => l.trimStart())
    .filter((l) => l.length > 0)   // drop blank lines between clauses
    .join("\n");

  // ── Step 2: ensure every top-level clause starts on its own line ──────────
  // Sort longest first so "GROUP BY" is matched before "GROUP"
  const sorted = [...CLAUSE_KEYWORDS].sort((a, b) => b.length - a.length);

  // Inject a newline before each clause keyword that isn't already at line start
  // Handles cases like:  "SELECT * FROM users" → multi-line
  let expanded = stripped;
  for (const kw of sorted) {
    const re = new RegExp(`(?<!^)(?<!\\n)\\b(${kw})\\b`, "gi");
    expanded = expanded.replace(re, "\n$1");
  }

  // ── Step 3: split into lines, identify which ones START with a clause ──────
  const lines = expanded.split("\n").filter((l) => l.trim().length > 0);

  const clauseStartRe = new RegExp(
    `^(${sorted.map((k) => k.replace(/ /g, "\\s+")).join("|")})\\b`,
    "i"
  );

  // ── Step 4: find the longest opening clause keyword for padding ───────────
  // We pad shorter keywords with spaces so their content aligns vertically
  //
  //   SELECT  u.id,               ← "SELECT"  = 6 chars, padded to 7 + 1 space
  //   FROM    users u             ← "FROM"    = 4 chars, padded to 7 + 1 space
  //   WHERE   u.status = 'active' ← "WHERE"   = 5 chars, padded to 7 + 1 space
  //   LEFT JOIN orders o          ← "LEFT JOIN" = 9 chars — multiword handled below

  let maxKwLen = 0;
  for (const line of lines) {
    const m = line.match(clauseStartRe);
    if (m) {
      // Normalise multi-space matches back to single space for length measurement
      const normalised = m[0].replace(/\s+/g, " ");
      maxKwLen = Math.max(maxKwLen, normalised.length);
    }
  }

  // ── Step 5: rebuild — clause lines get padded keyword, rest get indented ──
  const result: string[] = [];
  let insideClause = false;

  for (const line of lines) {
    const m = line.match(clauseStartRe);

    if (m) {
      insideClause = true;
      const kw = m[0].replace(/\s+/g, " ").toUpperCase();    // normalise spacing + case
      const rest = line.slice(m[0].length).trimStart();        // everything after keyword
      const pad = " ".repeat(maxKwLen - kw.length);            // right-pad keyword

      if (rest) {
        // Clause keyword and its content on one line: "WHERE  u.id = ?"
        result.push(`${kw}${pad}  ${rest}`);
      } else {
        result.push(kw);
      }
    } else if (insideClause) {
      const indent = " ".repeat(maxKwLen + 2);
      result.push(`${indent}${line.trim()}`);
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

function prettifySQL(text: string, dialect: SqlLanguage): string {
  const formatted = format(text.trim(), {
    language: dialect,
    keywordCase: "upper",   
    indentStyle: "standard",
    logicalOperatorNewline: "before",
    linesBetweenQueries: 1,
    tabWidth: 2,
    expressionWidth: 80,
    denseOperators: true,
  });


  return alignClauses(formatted)
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function postBeautify(sql: string): string {
  return (
    sql
      // keep LIMIT OFFSET together
      .replace(/LIMIT\s*\n\s*(\?)/g, 'LIMIT $1')
      .replace(/OFFSET\s*\n\s*(\?)/g, 'OFFSET $1')

      // keep WHERE conditions inline
      .replace(/WHERE\s*\n\s*/g, 'WHERE ')

      // keep ORDER BY inline
      .replace(/ORDER BY\s*\n\s*/g, 'ORDER BY ')

      // keep FROM inline
      .replace(/FROM\s*\n\s*/g, 'FROM ')

      // compact function calls
      .replace(/\(\s*\n\s*/g, '(')
      .replace(/\n\s*\)/g, ')')

      // remove excessive blank lines
      .replace(/\n{3,}/g, '\n\n')

      // remove trailing semicolon
      .replace(/;\s*$/, '')

      // remove trailing spaces
      .replace(/[ \t]+$/gm, '')
  )
}

function cleanupSQL(text: string): string {
  text = text.trim()

  // normalize whitespace
  text = text.replace(/\s+/g, ' ')

  const keywordFixes: Record<string, string> = {
    'se lect': 'select',
    'sel ect': 'select',
    'fr om': 'from',
    'wh ere': 'where',
    'gro up by': 'group by',
    'ord er by': 'order by',
    'ins ert': 'insert',
    'upd ate': 'update',
    'del ete': 'delete',
    'jo in': 'join',
    'li mit': 'limit',
    'of fset': 'offset',
    'va lue': 'value',
    'va lues': 'values',
    'va lue s': 'values',
    'le ft': 'left',
    'ri ght': 'right',
    'in ner': 'inner',
    'ou ter': 'outer',
    'le ft join': 'left join',
    'ri ght join': 'right join',
    'in ner join': 'inner join',
    'ou ter join': 'outer join'
  }

  for (const broken in keywordFixes) {
    const regex = new RegExp(broken, 'gi')
    text = text.replace(regex, keywordFixes[broken])
  }

  text = text.replace(/\s*,\s*/g, ', ')
  text = text.replace(/\s*=\s*/g, ' = ')

  return text
}

function alignSelectColumns(sql: string): string {
  const lines = sql.split('\n')

  return lines
    .map(line => {
      if (line.trim().startsWith(',')) {
        return '  ' + line.trim()
      }

      return line
    })
    .join('\n')
}

function looksLikeSQL(text: string): boolean {
  const keywords = [
    'select ',
    'insert ',
    'update ',
    'delete ',
    'join ',
    'from ',
    'where ',
    'set ',
    'and ',
    'or ',
    'like ',
    'in ',
    'limit ',
    'offset ',
    'values ',
    'left ',
    'on ',
    'right ',
    'inner ',
    'outer ',
    'group by ',
    'order by ',
    'count(',
    'sum(',
    'desc',
    'asc'
  ]

  const lower = text.toLowerCase()

  return keywords.some(k => lower.includes(k))
}

export function deactivate() { }
