import * as vscode from 'vscode'
import { format, SqlLanguage } from 'sql-formatter'

export function activate (context: vscode.ExtensionContext) {
  console.log('Universal SQL Formatter activated')

  // COMMAND: Format SQL query
  const formatCommand = vscode.commands.registerCommand(
    'sqlFormatter.formatQuery',
    async () => {
      const editor = vscode.window.activeTextEditor

      if (!editor) {
        vscode.window.showErrorMessage('No active editor found')
        return
      }

      const document = editor.document
      const selection = editor.selection

      let text = document.getText(selection)

      // If no selection → format entire document
      if (!text) {
        text = document.getText()
      }

      if (!looksLikeSQL(text)) {
        vscode.window.showWarningMessage(
          'Selected text does not appear to be SQL'
        )
        return
      }

      const config = vscode.workspace.getConfiguration('sqlFormatter')

      const dialect = (config.get<string>('dialect') ||
        'postgresql') as SqlLanguage

      let formatted = ''

      format(text, {
        language: dialect,
        keywordCase: 'upper',
        indentStyle: 'standard',
        linesBetweenQueries: 1
      })

      try {
        formatted = format(text, {
          language: dialect
        })
      } catch (err) {
        vscode.window.showErrorMessage('SQL formatting failed')
        return
      }

      editor.edit(editBuilder => {
        if (!selection.isEmpty) {
          editBuilder.replace(selection, formatted)
        } else {
          const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
          )

          editBuilder.replace(fullRange, formatted)
        }
      })
    }
  )

  context.subscriptions.push(formatCommand)

  // FORMAT DOCUMENT (.sql files)
  const sqlFormatter = vscode.languages.registerDocumentFormattingEditProvider(
    'sql',
    {
      provideDocumentFormattingEdits (document) {
        const config = vscode.workspace.getConfiguration('sqlFormatter')

        const dialect = (config.get<string>('dialect') ||
          'postgresql') as SqlLanguage

        const text = document.getText()

        let formatted = ''

        try {
          formatted = format(text, {
            language: dialect
          })
        } catch {
          return []
        }

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

// Detect SQL blocks inside code
function detectSQLBlocks (text: string) {
  const blocks: { sql: string; start: number; end: number }[] = []

  const regexList = [
    // template strings
    /`([\s\S]*?)`/g,

    // python multiline
    /"""([\s\S]*?)"""/g,

    // single quote multiline
    /'([\s\S]*?)'/g
  ]

  regexList.forEach(regex => {
    let match

    while ((match = regex.exec(text)) !== null) {
      const candidate = match[1]

      if (looksLikeSQL(candidate)) {
        blocks.push({
          sql: candidate,
          start: match.index + 1,
          end: match.index + match[0].length - 1
        })
      }
    }
  })

  return blocks
}

/*
Simple SQL detection
*/
function looksLikeSQL (text: string): boolean {
  const keywords = [
    'select',
    'insert',
    'update',
    'delete',
    'join',
    'left join',
    'right join',
    'where',
    'from',
    'group by',
    'order by'
  ]

  const lower = text.toLowerCase()

  return keywords.some(k => lower.includes(k))
}

// Optional helper for future features
export function extractSQLStrings (text: string): string[] {
  const regex = /`([\s\S]*?)`/g

  const matches: string[] = []

  let match

  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1])
  }

  return matches
}

export function deactivate () {}
