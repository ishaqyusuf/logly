# Pseudonymous actor event reads

Date: 2026-11-08
Status: source verified; production acceptance recorded in afterservice rollout handoff.

The project-scoped `/v1/dashboard/events` and `/v1/dashboard/event-summary`
reads accept optional `actor`, the 64-character lowercase hexadecimal actor key
already stored by Logly. Event rows expose nullable `actorId` with that stored
pseudonym. Missing actors stay null; no raw account ID or account lookup exists.
Invalid actor filters return JSON 400 after existing read-key authorization.
Project/organization/date/name/source filters remain conjunctive with actor.
All summary aggregates filter the complete matching window independently of
recent-event pagination. Demo/in-memory summaries use the same actor semantics.

Oversight discovered that production stored afterservice actors but omitted them
from the read response. This isolated contract supports the requested live user
filter without shipping pending generic groups, mobile SDK, project-selector,
credential-management or schema changes. No migration, ingestion policy, key
scope, origin policy or authorization expansion is required.

New actor helper/parser/matcher tests pass. Production-derived source passes
all 11-package-scope typechecks and focused DB/collector/utility tests. Browser
acceptance and deployment IDs live in the afterservice dated rollout handoff.
