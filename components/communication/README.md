# Communication UI

| File | Role |
|------|------|
| `canvas-page-client.tsx` | Client shell: Graph / List tabs, stats, connect-mode toggle wiring. |
| `canvas-v2.tsx` | Org-chart layout (Product vs Build streams), SVG edges, connect-mode, edge detail + wizard. |
| `canvas-node.tsx` | Single agent node card (avatar via `AgentRosterAvatar`, tier badge, stream badge). |
| `canvas-edges-svg.tsx` | SVG Bezier edges + arrowheads between measured node boxes. |
| `edge-wizard-dialog.tsx` | 5-step wizard for new edges; persists via `createEdge` Server Action. |
| `edge-form.tsx` / `edge-list.tsx` | V1 form + table; still used for list view & inline edge editing. |
| `communication-edges-section.tsx` | Composes `EdgeForm` + `EdgeList` for the list tab. |

## Tests

Canvas components lean on existing `lib/communication` policy tests. GitHub + git-config unit tests live under `lib/github/__tests__/`.
