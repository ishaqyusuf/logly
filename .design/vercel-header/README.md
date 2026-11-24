# Team → project header proposals

Open [index.html](index.html) to compare three responsive HTML proposals:

| Proposal | Interaction | Assessment |
| --- | --- | --- |
| A · Nested menu | Project list first, team change in a secondary step | Compact, but the team context is hidden while switching. |
| **B · Two columns** | **Teams and their projects visible in one menu** | **Recommended and implemented.** A single header trigger shows the active team/project path. |
| C · Separate controls | Independent team and project triggers | Clear labels, but costs header width on phones. |

The prototypes use Logly's current colors, real project names, responsive layout, semantic controls, and the vendored Pretext text layout engine. The React implementation lives in `apps/dashboard/src/components/workspace-selector.tsx`.

Vercel's [current dashboard navigation](https://vercel.com/changelog/dashboard-navigation-redesign-rollout) uses project filters across team and project views. Its [account guide](https://vercel.com/docs/accounts) places the team switcher at the top left. Proposal B adapts that navigation hierarchy to Logly's single-project workspace.
