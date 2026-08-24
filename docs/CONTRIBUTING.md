# Contributing

FormRelay welcomes noncommercial contributions compatible with the repository license.

Use a focused branch and keep trust boundaries explicit. New DOM support should include extraction, matching, validation, filling, and security tests. Do not add analytics, remote calls, broad host permissions, auto-submit behavior, CAPTCHA logic, password/payment filling, or large dependencies without a documented design reason.

Before opening a pull request run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. Keep TypeScript strict, avoid `any`, keep Zod at the import boundary, and prefer pure deterministic functions for schema and matching work.

Report security vulnerabilities privately according to the root `SECURITY.md` rather than opening a public exploit issue.
