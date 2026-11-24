# Database Relationships

Generic event groups are embedded snapshots, not foreign keys or Logly
organizations. Keys are hashed within project and group type. No cross-project
company/user relationship or mutable group-profile table is introduced.

- An organization has many projects; every project has one organization.
- A project has many keys, events, and daily rollups.
- Keys, events, and rollups cascade when a project is deleted.
- Daily rollups are unique by project, day, metric, and dimension pair.
- An auth user has many sessions and provider accounts; sessions and accounts
  cascade when the user is deleted.
- Organization deletion is restricted while projects still belong to it.
