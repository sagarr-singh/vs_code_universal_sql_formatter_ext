# Universal SQL Prettier

A powerful extension that **detects, repairs, and prettifies SQL queries** across your codebase.

Universal SQL Prettier formats SQL in `.sql` files as well as inside programming languages like **JavaScript, TypeScript, Go, and Python**.

It turns messy queries into clean, readable SQL instantly.

---

## ✨ Features

* 🔧 **Automatic SQL formatting**
* 🧹 **Broken SQL repair**
* 🔠 **Keyword normalization (UPPERCASE SQL)**
* 🎯 **Multi-selection formatting**
* 📄 **Format entire SQL documents**
* 🧠 **Smart SQL detection inside code**
* ⚡ **Fast formatting engine**
* 🗄 **Multiple SQL dialect support**

Supported dialects:

* PostgreSQL
* MySQL
* SQLite
* T-SQL

---

## 🎬 Demo

### Before → After formatting

![Before After](images/demo.png)

### Live demo

![Demo](images/demo.gif)

---

## ⚡ Commands

| Command          | Shortcut          |
| ---------------- | ----------------- |
| Format SQL Query | `Ctrl + Alt + P`  |
| Format Document  | `Shift + Alt + F` |

You can also access commands via:

```text
Command Palette → Format SQL Query
```

---

## 🧪 Example

### Before formatting

```sql
select id,name from users where id=1
```

### After formatting

```sql
SELECT
  id,
  name
FROM users
WHERE id = 1
```

---

## 🛠 Usage

### Format selected SQL

1. Select your SQL query
2. Press

```
Ctrl + Alt + P
```

### Format entire SQL document

```
Shift + Alt + F
```

or

```
Right Click → Format Document
```

---

## ⚙ Settings

### SQL Dialect

Choose which SQL dialect to format.

```json
{
  "sqlFormatter.dialect": "postgresql"
}
```

Supported values:

```
postgresql
mysql
sqlite
tsql
```

---

## 📦 Installation

1. Open **VS Code**
2. Go to **Extensions**
3. Search for

```
Universal SQL Prettier
```

4. Click **Install**

Marketplace page:

https://marketplace.visualstudio.com/items?itemName=sagarDev.universal-sql-prettier

---

## 🧠 Smart SQL Detection

Universal SQL Prettier can detect SQL queries embedded inside code.

Example:

```javascript
const query = `
select * from users where id=1
`;
```

Becomes:

```javascript
const query = `
SELECT *
FROM users
WHERE id = 1
`;
```

---

## 🚀 Roadmap

Upcoming improvements:

* SQL format on save
* SQL linting
* Query analysis
* Better SQL detection
* Advanced formatting rules
* More SQL dialect support

---

## 🤝 Contributing

Contributions are welcome.

If you'd like to improve the formatter or add new features:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

GitHub repository:

https://github.com/sagarr-singh/vs_code_universal_sql_formatter_ext

---

## 🐞 Issues

Found a bug or formatting issue?

Please report it here:

https://github.com/sagarr-singh/vs_code_universal_sql_formatter_ext/issues

---

## 📄 License

MIT License © Sagar Singh
