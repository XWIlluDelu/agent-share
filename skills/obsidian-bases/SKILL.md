---
name: obsidian-bases
description: Create and edit Obsidian Bases (.base files) with views, filters, formulas, and summaries. Use when working with .base files, creating database-like views of notes, or when the user mentions Bases, table views, card views, filters, or formulas in Obsidian.
---

# Obsidian Bases Skill

## Workflow

1. **Create the file**: Create a `.base` file in the vault with valid YAML content
2. **Define scope**: Add `filters` to select which notes appear (by tag, folder, property, or date)
3. **Add formulas** (optional): Define computed properties in the `formulas` section
4. **Configure views**: Add one or more views (`table`, `cards`, `list`, or `map`) with `order` specifying properties
5. **Validate**: Verify valid YAML; check all referenced properties and formulas exist
6. **Test in Obsidian**: Open the `.base` file to confirm view renders correctly

## Schema

```yaml
filters: 'expression'  # Single condition — use plain string (most common case)
# Multiple conditions use and/or/not:
# filters:
#   and: ['expr1', 'expr2']

formulas:              # Computed properties available across all views
  formula_name: 'expression'

properties:            # Display name overrides
  property_name:
    displayName: "Display Name"
  formula.formula_name:
    displayName: "Formula Display Name"

summaries:             # Custom summary formulas
  custom_name: 'values.mean().round(3)'

views:
  - type: table | cards | list | map
    name: "View Name"
    limit: 10
    groupBy:
      property: property_name
      direction: ASC | DESC
    filters:           # View-specific filters (merged with global)
      and: []
    order:             # Properties to display, in order
      - file.name
      - property_name
      - formula.formula_name
    summaries:         # Map properties to summary formulas
      property_name: Average
```

## Filter Syntax

```yaml
# Single filter (string)
filters: 'status == "done"'

# AND — all must be true
filters:
  and:
    - 'status == "done"'
    - 'priority > 3'

# OR — any can be true
filters:
  or:
    - 'file.hasTag("book")'
    - 'file.hasTag("article")'

# NOT — exclude matching
filters:
  not:
    - 'file.hasTag("archived")'

# Nested
filters:
  or:
    - file.hasTag("tag")
    - and:
        - file.hasTag("book")
        - file.hasLink("Textbook")
```

### Filter Operators

| Operator | Description |
|----------|-------------|
| `==` | equals |
| `!=` | not equal |
| `>` / `<` | greater/less than |
| `>=` / `<=` | greater/less than or equal |
| `&&` | logical and |
| `\|\|` | logical or |
| `!` | logical not |

## Properties

### Three Types

1. **Note properties** — From frontmatter: `author` (or `note.author`)
2. **File properties** — File metadata: `file.name`, `file.mtime`, `file.size`, `file.tags`, `file.links`, `file.folder`, `file.ctime`
3. **Formula properties** — Computed values: `formula.my_formula`

For the complete file properties reference, see [references/FUNCTIONS_REFERENCE.md](references/FUNCTIONS_REFERENCE.md).

## Key Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `date()` | `date(string): date` | Parse string to date |
| `now()` | `now(): date` | Current date and time |
| `today()` | `today(): date` | Current date (time = 00:00:00) |
| `if()` | `if(condition, trueResult, falseResult?)` | Conditional |
| `number()` | `number(any): number` | Convert to number (use for frontmatter string values in arithmetic) |
| `duration()` | `duration(string): duration` | Parse duration string |
| `file()` | `file(path): file` | Get file object |
| `link()` | `link(path, display?): Link` | Create a link |

### Duration Type (Important!)

Subtracting two dates returns a **Duration** type, not a number. Access a numeric field first:

```yaml
# CORRECT
"(date(due_date) - today()).days"        # Returns number of days
"(now() - file.ctime).days.round(0)"    # Rounded days

# WRONG — Duration doesn't support .round() directly
# "(now() - file.ctime).round(0)"
```

### Date Arithmetic

```yaml
"now() + \"1 day\""          # Tomorrow
"today() + \"7d\""            # A week from today
"(now() - file.ctime).days"  # Days since created (as number)
```

Duration units: `y/year/years`, `M/month/months`, `d/day/days`, `w/week/weeks`, `h/hour/hours`, `m/minute/minutes`, `s/second/seconds`

## View Types

### Table View
```yaml
views:
  - type: table
    name: "My Table"
    order: [file.name, status, due_date]
    summaries:
      price: Sum
```

### Cards View
```yaml
views:
  - type: cards
    name: "Gallery"
    order: [file.name, cover_image, description]
```

### List View
```yaml
views:
  - type: list
    name: "Simple List"
    order: [file.name, status]
```

### Map View
Requires latitude/longitude properties and the Maps community plugin.

## Default Summary Formulas

| Name | Input | Description |
|------|-------|-------------|
| `Average` | Number | Mathematical mean |
| `Min` / `Max` | Number | Smallest/largest value |
| `Sum` | Number | Sum of all numbers |
| `Range` | Number | Max - Min |
| `Median` | Number | Mathematical median |
| `Stddev` | Number | Standard deviation |
| `Earliest` / `Latest` | Date | Earliest/latest date |
| `Checked` / `Unchecked` | Boolean | Count of true/false |
| `Empty` / `Filled` | Any | Count of empty/non-empty |
| `Unique` | Any | Count of unique values |

## Embedding Bases

```markdown
![[MyBase.base]]
![[MyBase.base#View Name]]
```

## YAML Quoting Rules

- Use **single quotes** for formulas containing double quotes: `'if(done, "Yes", "No")'`
- Use **double quotes** for simple strings: `"My View Name"`
- Strings with special characters (`:`, `{`, `[`, `#`, etc.) must be quoted

## Troubleshooting

**YAML Syntax Errors:**

```yaml
# WRONG — colon in unquoted string
displayName: Status: Active

# CORRECT
displayName: "Status: Active"

# WRONG — double quotes inside double quotes
formulas:
  label: "if(done, "Yes", "No")"

# CORRECT — single quotes wrapping
formulas:
  label: 'if(done, "Yes", "No")'
```

**Common Formula Errors:**

```yaml
# WRONG — Duration is not a number
"(now() - file.ctime).round(0)"

# CORRECT — access .days first
"(now() - file.ctime).days.round(0)"

# Guard against missing properties
'if(due_date, (date(due_date) - today()).days, "")'

# Ensure formula.X is defined in formulas before using in order
```

For complete examples (Task Tracker, Reading List, Daily Notes), see [references/examples.md](references/examples.md).

## References

- [Bases Syntax](https://help.obsidian.md/bases/syntax)
- [Functions Reference](references/FUNCTIONS_REFERENCE.md)
- [Complete Examples](references/examples.md)
