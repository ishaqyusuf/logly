# Repository Structure

## Required Dashboard Conventions

- `components/modals/`
- `components/sheets/global-sheets.tsx`
- `components/sheets/global-sheets-provider.tsx`
- `components/tables/core/`
- `components/tables/<domain>/`
- `components/forms/`
- `components/sidebar.tsx`
- `app/[...slug]/page.tsx`
- `app/(sidebar)/layout.tsx`
- `app/(sidebar)/error.tsx`

## Package Direction

Apps depend on packages. Packages do not depend on apps. Shared UI remains product-agnostic.
