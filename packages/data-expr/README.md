# @rfjs/data-expr

Safe JSON expression engine — a thin [JSONata](https://jsonata.org) wrapper with compile-once
evaluation, DoS guards, and typed errors. **No JavaScript `eval`** — expressions are parsed to an
AST and evaluated functionally, so an expression string can never execute arbitrary code.

## Installation

```bash
npm install @rfjs/data-expr
```

## Usage

```typescript
import { compile, evaluate } from '@rfjs/data-expr';

const order = {
  items: [
    { sku: 'A', status: 'paid', amount: 400 },
    { sku: 'B', status: 'open', amount: 700 },
  ],
};

// compile once, evaluate many (evaluation is async — jsonata v2)
const total = compile('$sum(items.amount) * 2');
await total.evaluate(order); // 2200

// one-shot convenience (not for hot paths)
await evaluate("$count(items[status='paid'])", order); // 1
await evaluate("items[0].sku & '-' & items[0].status", order); // 'A-paid'
```

### Slot helpers

Consumers (e.g. `@rfjs/data-filter`) mark a computed metadata slot with a leading `=`:

```typescript
import { isExpression, stripExpressionPrefix } from '@rfjs/data-expr';

isExpression('=$sum(items.amount)'); // true
stripExpressionPrefix('=$sum(items.amount)'); // '$sum(items.amount)'
```

## Options

```typescript
compile(expr, {
  timeoutMs: 1000,   // wall-clock budget per evaluate() call (default 1000)
  maxDepth: 100,     // evaluation-depth budget (default 100)
  strict: false,     // true → an undefined result rejects instead of resolving undefined
  onUndefined: (expression) => console.warn('undefined result:', expression),
});
```

A compiled expression is reusable **sequentially** (compile once, evaluate row by row); it is not
safe for concurrent `evaluate()` calls on the same instance.

## Errors

Every failure is a `DataExprError` with a `kind` discriminant:

| kind | meaning |
|------|---------|
| `compile` | the expression string failed to parse (thrown synchronously by `compile`) |
| `evaluate` | evaluation threw (type errors, bad function arguments, …) |
| `timeout` | the `timeoutMs` budget was exceeded (runaway expression) |
| `depth` | the `maxDepth` budget was exceeded (deep/non-terminating recursion) |
| `undefined` | `strict` mode and the expression evaluated to `undefined` |

## Security

- **No RCE:** JSONata does not execute JavaScript. This package also exposes **no custom
  bindings** to the expression beyond the data object you pass — do not put secrets in it.
- **DoS guards on by default:** expressions are treated as potentially untrusted; `timeoutMs` /
  `maxDepth` abort runaway evaluations. Raise or relax them only for author-controlled expressions.
- **ReDoS caution:** `$match` / `$replace` with a *dynamic* (data- or user-derived) regex pattern
  is a ReDoS surface; the timeout bounds it, but prefer static patterns.

## JSONata gotchas

**Sequence collapse** — the same path expression changes shape with the hit count:

| hits | `items[status='paid']` returns |
|------|-------------------------------|
| 0 | `undefined` |
| 1 | the object itself (NOT a 1-element array) |
| n | an array |

**Coming from JSONPath?** Mapping table:

| JSONPath | JSONata |
|----------|---------|
| `items[*].amount` | `items.amount` (paths auto-map over arrays — no `[*]`) |
| `items[?(@.amount > 500)]` | `items[amount > 500]` |
| `$..name` | `**.name` |
| `$.a.b` | `a.b` (no `$.` root prefix) |
| — (not possible) | `$sum(items.amount)`, `$count(items[status='paid'])`, string functions, arithmetic |
