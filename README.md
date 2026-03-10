# Universal SQL Formatter VS Code Extension

Format SQL queries inside any programming language file.

Supports:

* JavaScript
* TypeScript
* Go
* Python
* SQL files

## Features

* Format selected SQL query
* Format entire `.sql` file
* Supports multiple SQL dialects
* Keyboard shortcut support

## Keyboard Shortcut

CTRL + ALT + F

## Example

Before:

select id,name from users where id=1

After:

SELECT
id,
name
FROM users
WHERE id = 1;

## Extension Settings

`sqlFormatter.dialect`

Supported values:

* mysql
* postgresql
* sqlite
* tsql

## Release Notes

### 0.0.1

Initial release of Universal SQL Formatter.
