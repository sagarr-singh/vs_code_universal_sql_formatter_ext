# Universal SQL Prettier

> Format SQL queries anywhere in your codebase — inside any file type, any string delimiter, multiple selections at once.

<p align="center">
  <img src="images/recordingSql.gif" width="800" alt="Universal SQL Prettier demo"/>
</p>

---

## Features

- **Vertical alignment** — every clause keyword (`SELECT`, `FROM`, `LEFT JOIN`, `ORDER BY`, …) and its content align to one straight column
- **Works in any file** — detects and formats SQL inside `` ` `` template literals, `"..."`, `'...'` strings, and raw `.sql` files
- **Multi-selection** — `Ctrl+Click` or `Ctrl+D` to select separate queries and format them all at once with one shortcut
- **Multiple queries** — select a block containing several SQL statements (separated by `;`, blank lines, or stacked keywords) and each is formatted independently
- **Keyword uppercase** — all SQL keywords are uppercased; string literal values are never touched
- **Subquery aware** — nested `(SELECT ...)` blocks are preserved as-is inside their parentheses, not re-aligned as top-level clauses
- **4 dialects** — PostgreSQL, MySQL, SQLite, T-SQL

---

## Demo

![Demo](images/demo.png)
![Demo](images/demo.gif)

---

## How it looks

**Before**

```sql
seLECT u.id,u.name,count(o.id)as order_count,sum(o.total)as revenue from users u LEFT join orders o on u.id=o.user_id where u.status='active' and u.created_at > '2024-01-01' group by u.id,u.name order by revenue desc limit 10 offset 20
```

**After**

```sql
SELECT      u.id,
            u.name,
            COUNT(o.id)  AS order_count,
            SUM(o.total) AS revenue
FROM        users u
LEFT JOIN   orders o
ON          u.id = o.user_id
WHERE       u.status = 'active'
  AND       u.created_at > '2024-01-01'
GROUP BY    u.id,
            u.name
ORDER BY    revenue DESC
LIMIT       10
OFFSET      20
```

**Subquery — stays intact**

```sql
SELECT    json_build_object(
            'loans', (
              SELECT COALESCE(json_agg(bl), '[]'::json)
              FROM loans.borrower_loans bl
              WHERE bl.customer_id = c.id
            )
          ) AS data
FROM      customers.customers c
ORDER BY  c.updated_at DESC
LIMIT     ?
OFFSET    ?
```

---

## Usage

### Format a single selection

1. Select any SQL text (raw query, template literal, quoted string)
2. Press `Ctrl+Alt+P` (Mac: `Cmd+Alt+P`)

### Format multiple separate queries

1. `Ctrl+Click` or `Ctrl+D` to add selections on each query you want
2. Press `Ctrl+Alt+P` — each selection is formatted independently

### Format a block with several queries

Select a block containing multiple statements separated by `;`, blank lines, or just stacked — all are detected and formatted individually.

### Format an entire `.sql` file

Use VS Code's built-in `Shift+Alt+F` (Format Document) — works automatically on `.sql` files.

### Right-click

Right-click anywhere in the editor → **SQL: Format Query**

---

## Supported string contexts

| Context                   | Example                                |
| ------------------------- | -------------------------------------- |
| Backtick template literal | `` const q = `SELECT * FROM users` ``  |
| Double-quoted string      | `query = "SELECT * FROM users"`        |
| Single-quoted string      | `query = 'SELECT * FROM users'`        |
| Raw `.sql` file           | entire file formatted on `Shift+Alt+F` |
| Plain selected text       | select any SQL and press `Ctrl+Alt+P`  |

---

## Commands

| Command           | Shortcut                   | Description                                          |
| ----------------- | -------------------------- | ---------------------------------------------------- |
| SQL: Format Query | `Ctrl+Alt+P` / `Cmd+Alt+P` | Format selection, multiple selections, or whole file |

---

## Configuration

```json
{
  "sqlFormatter.dialect": "postgresql",
  "sqlFormatter.formatOnSave": false,
  "sqlFormatter.keywordCase": "upper"
}
```

| Setting        | Type    | Default        | Options                              | Description                    |
| -------------- | ------- | -------------- | ------------------------------------ | ------------------------------ |
| `dialect`      | string  | `"postgresql"` | `postgresql` `mysql` `sqlite` `tsql` | SQL dialect                    |
| `formatOnSave` | boolean | `false`        | —                                    | Auto-format SQL blocks on save |
| `keywordCase`  | string  | `"upper"`      | `upper` `lower` `preserve`           | Case applied to SQL keywords   |

---

## FAQ

**My SQL isn't being formatted.**
Make sure the selected text contains a recognisable SQL statement (`SELECT … FROM`, `INSERT INTO`, `UPDATE … SET`, `DELETE FROM`, or `CREATE TABLE`). If it doesn't match, a warning is shown.

**Subqueries are being exploded onto separate lines.**
Update to the latest version — subquery-aware formatting (paren-depth tracking) was added to prevent this.

**Can I format SQL in Go / Python / Java files?**
Yes. Select the SQL string (with or without the surrounding quotes/backticks) and press `Ctrl+Alt+P`.

**Will `Shift+Alt+F` work on non-SQL files?**
No — the built-in Format Document provider is registered for `.sql` files only. Use `Ctrl+Alt+P` for other file types.

**I have multiple queries in one selection — will both be formatted?**
Yes. Queries separated by `;`, a blank line, or a new statement keyword at the top level are each formatted independently and joined back with a blank line between them.

---

## License

MIT — see [LICENSE](LICENSE)

## Issues & Requests

[github.com/sagarr-singh/vs_code_universal_sql_formatter_ext/issues](https://github.com/sagarr-singh/vs_code_universal_sql_formatter_ext/issues)
