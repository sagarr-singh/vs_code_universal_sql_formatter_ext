# Universal SQL Formatter

Format SQL queries anywhere in your codebase with advanced formatting options and intelligent detection.

## Features

✨ **Advanced SQL Formatting** - Professional-grade SQL formatting with multiple dialects  
🔧 **Smart Detection** - Automatically detects SQL in template literals and code blocks  
🎨 **Customizable Options** - Extensive configuration options for perfect formatting  
⚡ **Multi-Selection Support** - Format multiple selections simultaneously  
🎯 **Broken SQL Repair** - Automatically fixes common SQL typos and formatting issues  
📊 **Column Alignment** - Align SELECT columns for enhanced readability  
🔧 **Auto-Formatting** - Format on save with configurable triggers  

### Supported Dialects
* PostgreSQL
* MySQL
* SQLite
* T-SQL

### Advanced Configuration Options
* **Indent Width** - Customize indentation (1-8 spaces)
* **Keyword Case** - Upper, lower, or preserve original case
* **Expression Width** - Control line wrapping (40-200 characters)
* **Logical Operators** - Position AND/OR before or after line breaks
* **Column Alignment** - Align SELECT columns for better readability
* **Function Compaction** - Compact function calls for cleaner code
* **Comment Preservation** - Option to preserve SQL comments
* **Dense Operators** - Use compact operator formatting

## Demo

![Demo](images/demo.png)
![Demo](images/demo.gif)

<p align="center">
  <img src="images/demo.gif" width="800" alt="demo"/>
</p>

## Commands

| Command                    | Shortcut        | Description                          |
| -------------------------- | --------------- | ------------------------------------ |
| Format SQL Query           | Ctrl + Alt + P  | Format selected SQL or current query |
| Format Document            | Shift + Alt + F | Format entire SQL document           |
| Format SQL Document        | -               | Alternative document formatting      |

## Example

### Before:
```sql
select id,name from users where id=1 and status='active' order by created_at desc limit 10
```

### After:
```sql
SELECT
  id,
  name
  id,
  name
FROM users
WHERE id = 1
  AND status = 'active'
ORDER BY created_at DESC
LIMIT 10
```

### Complex Query Example:

**Before:**
```sql
select u.id,u.name,count(o.id)as order_count,avg(o.total)as avg_order from users u left join orders o on u.id=o.user_id where u.created_at>='2023-01-01' group by u.id,u.name having count(o.id)>5 order by avg_order desc limit 20
```

**After:**
```sql
SELECT
  u.id,
  u.name,
  COUNT(o.id) AS order_count,
  AVG(o.total) AS avg_order
FROM users u
LEFT JOIN orders o
  ON u.id = o.user_id
WHERE u.created_at >= '2023-01-01'
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 5
ORDER BY avg_order DESC
LIMIT 20
```

## Configuration

Configure the extension through VS Code settings:

```json
{
  "sqlFormatter.dialect": "postgresql",
  "sqlFormatter.formatOnSave": true,
  "sqlFormatter.indentWidth": 2,
  "sqlFormatter.keywordCase": "upper",
  "sqlFormatter.expressionWidth": 80,
  "sqlFormatter.logicalOperatorNewline": "before",
  "sqlFormatter.linesBetweenQueries": 1,
  "sqlFormatter.denseOperators": true,
  "sqlFormatter.alignSelectColumns": true,
  "sqlFormatter.compactFunctions": true,
  "sqlFormatter.preserveComments": false
}
```

### Configuration Options

| Setting                      | Type    | Default | Description                                    |
| ---------------------------- | ------- | ------- | ---------------------------------------------- |
| `dialect`                    | string  | "postgresql" | SQL dialect (postgresql/mysql/sqlite/tsql) |
| `formatOnSave`               | boolean | false   | Auto-format SQL files on save                  |
| `indentWidth`                | number  | 2       | Number of spaces for indentation (1-8)         |
| `keywordCase`                | string  | "upper" | Keyword case: upper/lower/preserve             |
| `expressionWidth`            | number  | 80      | Max width before wrapping (40-200)             |
| `logicalOperatorNewline`     | string  | "before" | AND/OR position: before/after                  |
| `linesBetweenQueries`        | number  | 1       | Blank lines between queries (0-5)              |
| `denseOperators`             | boolean | true    | Use dense operator formatting                  |
| `alignSelectColumns`         | boolean | true    | Align SELECT column names                      |
| `compactFunctions`           | boolean | true    | Compact function calls                         |
| `preserveComments`           | boolean | false   | Preserve SQL comments                          |

## Usage

### Formatting SQL in Code

The extension automatically detects SQL in various contexts:

**Template Literals (JavaScript/TypeScript):**
```javascript
const query = `
  select id, name from users where active = true
`;
```

**String Literals:**
```python
query = "select id, name from users where active = true"
```

**Multi-line Strings:**
```python
query = """
    select id, name 
    from users 
    where active = true
"""
```

### Selection-Based Formatting

1. **Single Selection**: Select SQL text and press `Ctrl+Alt+P`
2. **Multiple Selections**: Use multiple cursors to format several SQL blocks at once
3. **Document Formatting**: Use `Shift+Alt+F` to format entire SQL files

### Smart Detection

The extension uses intelligent pattern matching to detect SQL:

- **Keyword Analysis**: Detects SQL keywords, functions, and operators
- **Pattern Matching**: Recognizes common SQL structures
- **Context Awareness**: Works in template literals, strings, and comments
- **Fallback Prompt**: Asks before formatting if SQL detection is uncertain

## Error Handling

The extension provides comprehensive error handling:

- **Syntax Validation**: Validates SQL syntax before formatting
- **Graceful Degradation**: Continues working even with minor issues
- **User Feedback**: Clear error messages for troubleshooting
- **Recovery Options**: Suggests alternatives when formatting fails

## Performance

- **Optimized Processing**: Efficient handling of large SQL files
- **Incremental Formatting**: Only processes changed sections when possible
- **Memory Management**: Proper cleanup and resource management
- **Responsive UI**: Non-blocking operations for better user experience

<!-- ## Contributing -->

<!-- Contributions are welcome! Please read our [contribution guidelines](CONTRIBUTING.md) before submitting pull requests. -->

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues, questions, or feature requests:

1. Check the [FAQ](#faq) section
2. Search existing [issues](https://github.com/sagarr-singh/vs_code_universal_sql_formatter_ext/issues)
3. Create a new [issue](https://github.com/sagarr-singh/vs_code_universal_sql_formatter_ext/issues/new) with details

## FAQ

**Q: Why isn't my SQL being formatted?**
A: The extension uses smart detection. If it's uncertain, it will prompt you. Try selecting the text manually or check if your SQL contains recognizable keywords.

**Q: Can I format SQL in non-SQL files?**
A: Yes! The extension works in any file type and can detect SQL in template literals, strings, and comments.

**Q: How do I preserve my custom formatting?**
A: Use the `preserveComments` setting and choose `preserve` for `keywordCase` to maintain your formatting style.

**Q: Why are my function calls being compacted?**
A: This is the default behavior for cleaner code. Disable `compactFunctions` in settings to preserve original spacing.

**Q: Can I use this with other SQL extensions?**
A: Yes, but you may need to disable conflicting formatters to avoid conflicts.
