# Design: init-architecture-scan

## Approach

`auok init` creates the standard workspace and then initializes architecture context:

1. Ignore generated/cache/system entries such as `.git`, `auok`, `.auok`, `node_modules`, `dist`, `build`, and hidden local directories.
2. If no business files remain, treat the repository as empty and only create `auok/architecture/`.
3. If business files exist, write deterministic placeholder drafts under `auok/architecture/`.
4. Do not hard-code architecture analysis in the backend. Backend init only materializes the workspace and placeholders.
5. Use `--lang zh|en` to choose generated document language. Default is `zh`.
6. The `/auok init` skill instructs the active model session to use `auok-architect` for architecture analysis, including module responsibility, entrypoints, build/test strategy, and middleware/framework evidence.

The generated architecture files are placeholders, not final authority. The active model session should complete them during init, and future agents should continue refining them as they work.

## Verification

- Run init in an empty temporary directory and confirm `project_mode=empty`.
- Run init in a non-empty temporary directory and confirm architecture markdown files are generated.
- Run `npm run verify-env`.

## Risks

- If the active model session skips the Architect skill, architecture files will remain placeholders.
- Architecture conclusions must cite evidence to avoid model hallucination.
