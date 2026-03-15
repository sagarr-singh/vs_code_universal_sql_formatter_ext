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

function prettifySQL(text: string, dialect: SqlLanguage): string {
  let cleaned = cleanupSQL(text)

  let formatted = format(cleaned, {
    language: dialect,
    keywordCase: 'upper',
    indentStyle: 'standard',
    logicalOperatorNewline: 'before',
    linesBetweenQueries: 1,
    tabWidth: 2,
    expressionWidth: 80,
    denseOperators: true
  })

  formatted = alignSelectColumns(formatted)

  formatted = formatted.replace(/\s+(AND|OR)\s+/gi, '\n  $1 ')

  formatted = formatted.replace(/\n{3,}/g, '\n\n')

  return formatted.trim()
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
