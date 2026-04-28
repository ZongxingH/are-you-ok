# Design: init-architecture-scan

## Approach

`auok init` creates the standard workspace and then initializes architecture context:

1. Ignore generated/cache/system entries such as `.git`, `auok`, `.auok`, `node_modules`, `dist`, `build`, and hidden local directories.
2. If no business files remain, treat the repository as empty and only create `auok/architecture/`.
3. If business files exist, run a deterministic read-only scan:
   - detect common marker files such as `package.json`, `pom.xml`, `go.mod`, `pyproject.toml`, and `Cargo.toml`
   - identify common entry points
   - list top-level modules
   - identify common test file patterns
4. Write generated summaries under `auok/architecture/`.
5. Use `--lang zh|en` to choose generated document language. Default is `zh`.

The generated architecture is starting context, not final authority. Future agents should refine it as they work.

## Verification

- Run init in an empty temporary directory and confirm `project_mode=empty`.
- Run init in a non-empty temporary directory and confirm architecture markdown files are generated.
- Run `npm run verify-env`.

## Risks

- File-pattern detection can miss uncommon frameworks.
- Generated architecture can be incomplete; documents must state that they are initial scan output.
