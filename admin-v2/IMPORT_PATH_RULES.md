# Import Path Rules for admin-v2

## Path Rules Based on Directory Depth

### Components at `features/*/` level (2 levels deep):
- To `core/`: `../../core/`
- To `shared/`: `../../shared/`
- Examples:
  - `features/editor/editor.component.ts` → `../../core/`
  - `features/settings/settings.component.ts` → `../../core/`
  - `features/display/display.component.ts` → `../../core/`

### Components at `features/*/*/` level (3 levels deep):
- To `core/`: `../../../core/`
- To `shared/`: `../../../shared/`
- Examples:
  - `features/editor/library-editor/library-editor.component.ts` → `../../../core/`
  - `features/playlist/manual/manual.component.ts` → `../../../core/`
  - `features/settings/general-settings/general-settings.component.ts` → `../../../core/`

### Services at `features/*/services/` level (3 levels deep):
- To `core/`: `../../../core/`
- Examples:
  - `features/editor/services/collections.service.ts` → `../../../core/`
  - `features/playlist/services/playlist.service.ts` → `../../../core/`

### Sibling feature imports:
- From `features/editor/library-editor/` to `features/playlist/`: `../../playlist/`
- From `features/user-profile/` to `features/settings/`: `../settings/`

## Quick Reference

| From | To `core/` or `shared/` | Levels Up |
|------|------------------------|-----------|
| `features/*.ts` | `../../` | 2 |
| `features/*/*.ts` | `../../../` | 3 |
| `features/*/services/*.ts` | `../../../` | 3 |
