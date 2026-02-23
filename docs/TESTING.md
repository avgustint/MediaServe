# Testing Guide

## Running Tests

### Run All Tests (from repo root)
```bash
npm test
```
Runs server tests and admin-v2 tests.

### Run Individual Test Suites

**Server tests** (Node.js built-in test runner):
```bash
npm run test:server
# or: cd server && npm test
```

**Admin app tests** (Karma + Jasmine):
```bash
npm run test:admin
# or: cd admin-v2 && npm test
```

For CI/headless environments where ChromeHeadless may fail to start:
```bash
cd admin-v2 && npm test -- --browsers=ChromeHeadlessCI
```

## Test Structure

### Server (`server/`)
- Uses Node.js built-in test runner (`node --test`)
- Test files: `*.test.js` (e.g. `config.test.js`, `utils/password.test.js`)
- No additional dependencies required

### Admin (`admin-v2/`)
- Uses Karma + Jasmine
- Test files: `*.spec.ts` next to source files
- Key test files:
  - `app.component.spec.ts` - App smoke test
  - `core/services/translation.service.spec.ts` - Translation service
  - `core/guards/auth.guard.spec.ts` - Auth guard
  - `shared/pipes/format-text.pipe.spec.ts` - Format text pipe

## Adding New Tests

### Server
Create a file named `*.test.js` and use Node's test API:
```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('myModule', () => {
  it('should do something', () => {
    assert.strictEqual(1 + 1, 2);
  });
});
```

Add the file to `server/package.json` scripts if not auto-discovered.

### Admin (Angular)
Generate a spec file or create alongside your component:
```bash
ng generate component my-component
# Creates my-component.component.spec.ts
```
