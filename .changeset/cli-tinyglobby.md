---
"@buildpad/cli": patch
---

`validate` and `fix` find files with tinyglobby instead of fast-glob. fast-glob brought in `braces`, which has an unpatched denial-of-service advisory (GHSA-vfj7-8cjw-p6xm), into every project that installs the CLI. Patterns are now relative to the directory being searched, so a project path with Windows backslashes is no longer read as glob escapes.
