---
trigger: always_on
---

# Git Conventions — Rota

## 1. Change Discipline

- Make changes focused on the approved task. Do not bundle unrelated refactors, dependency upgrades, or behavior changes into a feature without authorization.
- Preserve the existing repository structure and conventions unless the task explicitly requires changing them.
- Use descriptive commit messages that identify the purpose of the change.
- Keep changes small enough to review and verify when practical.

## 2. Protected Files and Secrets

- Never commit `.env` files, API keys, passwords, private certificates, access tokens, payment secrets, or production credentials.
- Maintain an up-to-date `.env.example` containing required variable names and safe placeholder values, never real secrets.
- Before committing, check that no secrets, personal data, production exports, or sensitive logs are included.
- Do not remove or rewrite another contributor's work merely to simplify the current task.

## 3. Database and Integration Changes

- Include required Prisma schema and migration changes with the feature that depends on them.
- Never modify an already-applied migration as a way to change production schema history.
- Keep environment configuration changes documented.
- Treat changes to payment flows, authentication, authorization, tenant isolation, scheduling constraints, and background jobs as high-risk changes requiring targeted verification.

## 4. Before Completion

- Run the relevant tests, linting, type checks, and migration checks defined by the repository.
- Review the final diff for accidental changes, debug code, commented-out implementations, and sensitive information.
- Report checks that failed, were skipped, or could not be run. Never claim unverified success.
- Do not create a commit, push a branch, open a pull request, or rewrite Git history unless the user or task explicitly authorizes that action.