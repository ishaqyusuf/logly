# Task Roadmap

1. Complete MVP implementation and deploy demo mode.
2. Finish production trust: persistence migration, fail-closed configuration,
   retention, backups, and measured collection health. Full-scope aggregates,
   authentication, and origin/signature enforcement are implemented.
3. Apply the Better Auth migration and bootstrap the owner. Complete final
   authenticated browser validation against production persistence.
4. Publish the coordinated `0.2.0` SDK package versions.
5. Pilot with Afterservice using automatically discovered, bounded events.
6. Integrate a second product with different event semantics and review the
   shared interface only after both pilots.
7. Add the notification platform, CSV export, portfolio health, north-star
   counts, and a daily digest.
8. Consider a mobile adapter only after a real mobile integration requires it.
