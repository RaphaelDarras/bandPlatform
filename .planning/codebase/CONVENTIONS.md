# Coding Conventions

**Analysis Date:** 2026-02-13

## Naming Patterns

**Files:**
- Kebab-case for executable scripts: `gsd-tools.js`, `gsd-check-update.js`, `gsd-statusline.js`
- Camelcase for test files with `.test.js` suffix: `gsd-tools.test.js`
- UPPERCASE for special files: `ROADMAP.md`, `STATE.md`, `SUMMARY.md`, `PLAN.md`

**Functions:**
- camelCase for function names: `parseIncludeFlag()`, `safeReadFile()`, `loadConfig()`, `normalizePhaseName()`
- Descriptive, verb-based names that clearly indicate action: `execGit()`, `extractFrontmatter()`, `isGitIgnored()`
- Helper/utility functions use `safe` prefix for error-tolerant operations: `safeReadFile()`

**Variables:**
- camelCase for local variables and parameters: `includeIndex`, `configPath`, `cwd`, `filePath`
- CONSTANT_CASE for unchanging configuration tables: `MODEL_PROFILES`, `TOOLS_PATH`
- Descriptive names indicating data type: `exitCode`, `stdout`, `stderr`, `padded`

**Types/Constants:**
- Object keys in snake_case for configuration and structured data: `model_profile`, `commit_docs`, `branching_strategy`, `phase_branch_template`
- Nested configuration sections use descriptive names: `{ section: 'planning', field: 'commit_docs' }`

## Code Style

**Formatting:**
- No explicit linter detected (no `.eslintrc` or similar files)
- Indentation: 2 spaces
- Semicolons: Used consistently throughout
- Line length: Generally reasonable, no evidence of strict column limits

**Linting:**
- Not detected in this early-stage project
- Recommendation: Consider adding ESLint with standard config once project grows

**Spacing:**
- Single space before/after operators: `===`, `!==`, `=`
- Ternary operators on single line when reasonable: `get('model_profile') ?? defaults.model_profile`
- Comments preceded by blank lines in sections

## Import Organization

**Order:**
1. Built-in Node.js modules: `require('fs')`, `require('path')`, `require('child_process')`
2. No external dependencies in current codebase
3. Configuration/constants follow imports

**Path Aliases:**
- Not used; files use relative/absolute paths via `path.join()` and `path.resolve()`

## Error Handling

**Patterns:**
- Try-catch blocks for I/O operations: `safeReadFile()`, `loadConfig()`, `execSync()` calls
- Graceful fallback to defaults on error: `catch { return defaults; }`
- Silent failures for optional file reads: `catch { return null; }`
- Error objects include context: `err.status`, `err.stdout`, `err.stderr`
- Validation of parsed JSON with try-catch, no validation of schema beyond type checks

**Function approach:**
```javascript
function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}
```

## Logging

**Framework:** console (no external logging framework detected)

**Patterns:**
- JSON output for programmatic consumption: `JSON.stringify()` results
- Stderr and stdout separation in git operations
- Exit codes for CLI success/failure: `exitCode: 0` for success, non-zero for failure
- No debug logs visible; stderr used only for actual errors

## Comments

**When to Comment:**
- Used for major sections and entry points
- JSDoc-style block comments for CLI usage documentation
- Function-level explanatory comments for complex logic (phase normalization, config resolution)

**JSDoc/TSDoc:**
- Not used in current code; plain JavaScript without type annotations
- Large usage documentation at file header with command categorization

**Example comment style:**
```javascript
// ─── Model Profile Table ─────────────────────────────────────────────────────
// Section dividers use dashes for visual clarity
```

## Function Design

**Size:**
- Functions generally 10-30 lines
- Helper functions like `parseIncludeFlag()` and `safeReadFile()` are 3-5 lines
- Complex operations like `loadConfig()` are ~50 lines with nested logic
- Guideline: Keep utility functions small, acceptable to have larger orchestration functions

**Parameters:**
- Usually 1-3 parameters
- Configuration passed via `cwd` parameter (working directory)
- Flags/options extracted from `args` array, not separate parameters
- Pattern: `function(filePath)`, `function(cwd, args)`, `function(content)`

**Return Values:**
- Consistent return types: functions return objects with structured data
- Null/undefined for missing optional data
- Objects with `{ exitCode, stdout, stderr }` for shell operations
- JSON-serializable structures for CLI output

**Early returns:**
- Used to avoid nested conditions: `if (!match) return phase;`

## Module Design

**Exports:**
- Monolithic module: `gsd-tools.js` is single Node.js script with command dispatcher
- No named exports detected; main entry point uses `require()` and runs immediately
- Pattern: Process CLI args, dispatch to appropriate handler, output JSON or text

**Structure:**
```javascript
// Constants (MODEL_PROFILES)
// Helper functions (parseIncludeFlag, safeReadFile, etc.)
// Main command dispatcher (reads process.argv, routes to handlers)
// Process.exit() at end
```

**Barrel Files:**
- Not used; single entry point pattern for CLI tools

## Special Patterns

**Configuration Resolution:**
- Cascading defaults: Provide base defaults, then override from config file
- Nested config access pattern: `get('key', { section: 'parent', field: 'child' })`
- Safe fallback: Always return default if config missing or parse fails

**Path Handling:**
- Use `path.join()` for all path operations, never string concatenation
- Relative paths from `cwd` parameter, not process.cwd()
- Shell escape special characters in git operations: `a.replace(/[^a-zA-Z0-9._\-/]/g, '')`

**Git Operations:**
- All git calls go through `execGit()` helper
- Returns object with `{ exitCode, stdout, stderr }` for inspection
- Args array converted to shell-escaped string

---

*Convention analysis: 2026-02-13*
