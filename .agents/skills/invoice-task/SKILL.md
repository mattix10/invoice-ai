---
name: invoice-task
description: Implement one numbered InvoiceAI repository task with appropriate skills, independent review, verification, a PR and a demonstration.
---

# InvoiceAI task workflow

Invoke as `$invoice-task 05b` with a task identifier. Find the matching task in `tasks/`, read the applicable AGENTS.md files and task prerequisites, and preserve existing work. If the identifier is ambiguous, resolve it from context or ask. Respect the task's scope, dependency approvals and verification gates.

Select and read skills that apply to the actual changes: backend implementation, tests and architecture review for backend work; Angular feature, developer, readable-code and unit-test skills for relevant frontend work. Apply additional domain skills when applicable. State the intended file manifest when the task or selected skill requires it.

Use suitable agents for independent research and review when delegation is authorized and available. Implement the task, run its required checks, inspect the complete diff including untracked files, and fix actionable review findings. Report actual results and blockers; do not claim skipped checks passed.

Prepare a focused branch and PR using `.github/pull_request_template.md` and report its link. Use `pr-demo-video` after the PR exists; consider API documentation or browser-visible API calls for backend work, respecting task restrictions. Explain when a truthful demonstration cannot be recorded. Follow the user's instructions and applicable permissions for external actions; do not merge or deploy without authorization. Stop at the assigned task boundary.

