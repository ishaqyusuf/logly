# Product Vision

## Purpose

Give one operator a trustworthy, privacy-conscious view of activity and
operational health across a small portfolio of products without operating or
paying for a general-purpose analytics platform.

## Principles

- Capture only events that support a decision.
- Prefer daily visits and explicit domain events over automatic pageview exhaust.
- Treat trustworthy counts and visible data quality as product features.
- Keep project identity isolated.
- Make health and data quality visible alongside counts.
- Keep the shared tracking interface small; hide consent, batching, delivery,
  validation, and identity handling inside reusable packages.
- Accept bounded operational events such as `webhook_failed` or
  `background_job_completed`; reject unrestricted logs, stack traces, secrets,
  form values, and personal data.
- Do not grow into an OpenPanel/PostHog clone. Add a capability only after the
  same decision need appears in at least two real product integrations.
