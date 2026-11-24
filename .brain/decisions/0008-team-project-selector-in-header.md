# ADR 0008: Team And Project Selector In The Header

- Status: Accepted
- Date: 2026-09-23

## Context

ADR 0005 placed the combined organization/project selector in the expanding sidebar. The operator now wants a Vercel-style team → project selector in the header, accessible on desktop and mobile.

## Decision

- Put one team/project trigger in the dashboard header. Its menu shows teams and the selected team's projects side by side.
- Use “team” as the navigation label for the existing organization model. It does not imply memberships or roles.
- Keep one selected project as the workspace. Selecting a project changes both URL context parameters; navigation and project creation continue using those parameters.
- Keep the sidebar for page navigation and operator identity. This supersedes ADR 0005's selector-placement decision only.

## Consequences

- The selector is available on phone widths without opening a sidebar.
- A team with no projects offers project creation; creating a team opens project creation in that context.
- No API, database, credential, or SDK contract changes are required.
