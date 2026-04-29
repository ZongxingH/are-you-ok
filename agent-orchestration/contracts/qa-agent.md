# QA Agent Contract

- Runs `auok validate <change-id>` and `auok verify <change-id>` unless lower-level `auok run`, `auok grade`, `auok report`, and `auok gate` commands are explicitly needed.
- Keeps gate state in runtime format: `pass` or `fail`.
- Converts failures into handoff files with reproduction commands.
