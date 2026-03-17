# Testing Patterns

**Analysis Date:** 2026-02-13

## Test Framework

**Runner:**
- Node.js built-in `node:test` module
- No external test framework (Jest, Vitest, Mocha)
- Config: None (uses Node.js test runner directly)

**Assertion Library:**
- `node:assert` built-in module (strict assertions)
- Uses `assert.ok()`, `assert.strictEqual()`, `assert.deepStrictEqual()`

**Run Commands:**
```bash
node gsd-tools.test.js        # Run all tests (Node.js default)
npm test                      # Currently echoes error (no test setup)
```

## Test File Organization

**Location:**
- Co-located with implementation: `gsd-tools.test.js` in same directory as `gsd-tools.js`
- Both at: `.claude/get-shit-done/bin/`

**Naming:**
- Pattern: `{module-name}.test.js`
- Example: `gsd-tools.js` → `gsd-tools.test.js`

**Structure:**
```
.claude/
├── get-shit-done/
│   └── bin/
│       ├── gsd-tools.js          # Implementation
│       └── gsd-tools.test.js     # Tests
├── hooks/
│   ├── gsd-check-update.js
│   └── gsd-statusline.js
└── settings.json
```

## Test Structure

**Suite Organization:**
Test file uses Node.js `describe()` blocks for logical grouping by command/feature:

```javascript
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

describe('history-digest command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty phases directory returns valid schema', () => {
    // Test implementation
  });
});
```

**Patterns:**

- **Setup (beforeEach):** Create temporary test project directory with `.planning` structure
- **Teardown (afterEach):** Clean up temporary files to prevent test pollution
- **Test pattern:** Arrange (setup files), Act (run command), Assert (verify output)

**Example test structure:**
```javascript
test('extracting nested frontmatter works correctly', () => {
  // Arrange: Write test file to disk
  const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
  fs.mkdirSync(phaseDir, { recursive: true });
  fs.writeFileSync(
    path.join(phaseDir, '01-01-SUMMARY.md'),
    `---
phase: "01"
provides:
  - "Database schema"
---`
  );

  // Act: Run command
  const result = runGsdTools('history-digest', tmpDir);

  // Assert: Verify results
  assert.ok(result.success, 'command should succeed');
  const digest = JSON.parse(result.output);
  assert.deepStrictEqual(digest.phases['01'].provides, ['Database schema']);
});
```

## Test Execution Pattern

**Helper functions:**
```javascript
// Execute CLI command in subprocess
function runGsdTools(args, cwd = process.cwd()) {
  try {
    const result = execSync(`node "${TOOLS_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: result.trim() };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString().trim() || '',
      error: err.stderr?.toString().trim() || err.message,
    };
  }
}

// Create isolated temp directory with GSD structure
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}

// Cleanup
function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
```

## Mocking

**Framework:** Manual file system mocking using `fs` module

**Patterns:**
Tests mock file system by creating real temporary directories and files:
```javascript
fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });
fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), `---\nwave: 1\n---\n## Task 1`);
```

**What to Mock:**
- File system: Create actual temp directories (`fs.mkdtempSync()`)
- Filesystem content: Write test fixtures with `fs.writeFileSync()`
- Working directory: Pass `tmpDir` as `cwd` parameter to command runner
- Git operations: Not mocked; commands read actual git state from test directories

**What NOT to Mock:**
- Subprocess execution: Commands actually run via `execSync()` to test real behavior
- File I/O: Use real filesystem with temp directories, not in-memory mocks
- JSON parsing: Test actual parsing and error handling

## Fixtures and Factories

**Test Data:**
Inline fixtures created within tests using string templates with YAML frontmatter:

```javascript
fs.writeFileSync(
  path.join(phaseDir, '01-01-SUMMARY.md'),
  `---
phase: "01"
name: "Foundation Setup"
dependency-graph:
  provides:
    - "Database schema"
    - "Auth system"
  affects:
    - "API layer"
tech-stack:
  added:
    - "prisma"
    - "jose"
patterns-established:
  - "Repository pattern"
key-decisions:
  - "Use Prisma over Drizzle"
---

# Summary content here
`
);
```

**Factory approach:**
```javascript
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}
```

**Location:**
- Fixtures created in each test's `beforeEach()`
- Temp directories isolated per test, cleaned up in `afterEach()`
- No shared fixture files; all generated fresh per test

## Coverage

**Requirements:** Not enforced (no coverage config detected)

**View Coverage:**
- Not implemented; no coverage tools configured
- Recommendation: Add nyc/c8 coverage reporter if coverage goals defined

**Current approach:** Comprehensive test suite (~2000 lines) covering:
- Command parsing and dispatch
- File I/O operations
- Config resolution and defaults
- Phase numbering and renumbering
- Roadmap parsing
- Frontmatter extraction
- State management

## Test Types

**Unit Tests:**
- Individual command testing: `history-digest command`, `phases list command`
- Helper function testing through command dispatch
- Each test focuses on single command or feature
- Isolation: Use separate temp directories per test

**Integration Tests:**
- Full workflow simulation: Multi-phase scenarios with dependencies
- Filesystem state verification: Check files created/modified correctly
- Command chaining: Run multiple commands, verify state progression
- Example: `phase add`, then `phase insert`, then `phase remove` sequence

**E2E Tests:**
- Not explicitly separated; integration tests serve as E2E
- Examples:
  - `'removes phase directory and renumbers subsequent'` - Tests full phase removal workflow
  - `'milestone complete'` - Tests archiving, file creation, ROADMAP updates

## Common Patterns

**Async Testing:**
Tests are synchronous; no async/await patterns:
```javascript
test('synchronous file operations', () => {
  // All file ops are sync (readFileSync, writeFileSync, mkdirSync)
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), content);
  const result = runGsdTools('state-snapshot', tmpDir);
  assert.ok(result.success);
});
```

**Error Testing:**
Testing failures and error conditions explicitly:
```javascript
test('rejects removal of phase with summaries unless --force', () => {
  fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

  // Should fail without --force
  const result = runGsdTools('phase remove 1', tmpDir);
  assert.ok(!result.success, 'should fail without --force');
  assert.ok(result.error.includes('executed plan'), 'error message check');

  // Should succeed with --force
  const forceResult = runGsdTools('phase remove 1 --force', tmpDir);
  assert.ok(forceResult.success, `Force remove failed: ${forceResult.error}`);
});
```

**Success/Failure validation:**
```javascript
test('command execution pattern', () => {
  const result = runGsdTools('command args', tmpDir);

  // Always check success first
  assert.ok(result.success, `Command failed: ${result.error}`);

  // Parse output (expected to be JSON)
  const output = JSON.parse(result.output);

  // Verify structure
  assert.strictEqual(output.field_name, expected_value);
});
```

**Data structure verification:**
Tests validate complex nested structures:
```javascript
assert.deepStrictEqual(
  digest.phases['01'].provides.sort(),
  ['Auth system', 'Database schema'],
  'nested array values'
);

assert.deepStrictEqual(output.waves['1'], ['03-01', '03-02'], 'wave grouping');
```

## Test Organization by Feature

**GSD Tools commands tested:**

1. **History & Aggregation:** `history-digest`, `summary-extract`, `state-snapshot`
2. **Phase Operations:** `phase add`, `phase insert`, `phase remove`, `phase complete`, `next-decimal`
3. **Roadmap Operations:** `roadmap analyze`, `roadmap get-phase`
4. **Progress Tracking:** `progress json`, `progress bar`, `progress table`
5. **Validation:** `validate consistency`
6. **Scaffolding:** `scaffold context`, `scaffold uat`, `scaffold verification`, `scaffold phase-dir`
7. **Milestone Operations:** `milestone complete`
8. **State Management:** `state-snapshot`, `phase-plan-index`

---

*Testing analysis: 2026-02-13*
