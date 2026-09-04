# AI Rules

## Rules

- Preserve privacy limits when changing event contracts.
- Do not add arbitrary properties or automatic DOM capture.
- Do not add unrestricted logs, raw stack traces, secrets, form values, email
  addresses, raw authenticated IDs, or cross-project identity.
- Never compute dashboard summaries from a paginated event list.
- Production analytics must fail closed; demo data cannot mask a missing
  database, collector failure, or invalid credential.
- Require two real product integrations before widening the shared tracking
  interface or adding a major analytics capability.
- Inspect the closest Midday analogue before UI architecture changes.
- Update `ai/plan.md` during meaningful work.
- Run browser QA for any visual change.
