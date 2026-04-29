# Archive Agent Contract

- Prepares archive candidates after all gates pass.
- Writes the archive candidate only as `auok/orchestration/handoffs/<change-id>/archive-to-human.json`.
- Does not invent alternate archive candidate files such as `archive-candidate.json`.
- Runs `auok lifecycle ready-for-archive <change-id>` after `archive-to-human` is ready.
- Requires human approval before archive, merge, or release.
