# Organizations And Projects

## Purpose

Give the Logly operator a Vercel/OpenPanel-style organization and project
context without turning the thin analytics replacement into a broad team or
billing platform.

## Behavior

- Every project belongs to one organization.
- Organization and project slugs are derived automatically from their names.
- The desktop sidebar follows GND's compact `84px` rail and hover-expands to
  `268px`, with the combined organization/project selector directly below the
  Logly logo, navigation in the middle, and operator identity at the bottom.
- The selector always resolves to one project. It can switch organizations,
  switch projects, create an organization, and open project creation in the
  selected context, but it does not expose an all-project analytics scope.
- A selected project behaves as the dashboard workspace. Overview, Events,
  Live, Insights, and Settings inherit that project. Switching in the sidebar
  replaces all page data and preserves the project in the URL so views are
  linkable and refresh-safe.
- Projects is not a sidebar navigation item. Project switching and creation
  live in the selector; project-specific configuration lives in Settings.
- Project creation returns scoped credentials once; event names continue to be
  accepted automatically with no catalog setup.
- Legacy `/projects` links redirect to project Settings. The selector is the
  only project navigation surface, so analytics pages never expose a separate
  portfolio workspace.

## Current Scope

Logly remains single-operator. Organizations group projects for navigation but
do not add memberships, invitations, roles, subscriptions, billing, or
portfolio analytics. Project slugs remain globally unique to preserve the thin
collector envelope and existing SDK configuration.

## Validation

- The third migration was applied to local Docker PostgreSQL.
- A second local organization and an Afterservice project were created through
  the dashboard UI.
- The selector preserved the organization/project URL context after refresh.
- `local_infra_verified` was sent through Afterservice's local same-origin route
  and appeared under the selected Logly project without catalog registration.
- Production migration and authenticated browser QA confirmed the existing
  Afterservice project under the seeded Personal organization.
