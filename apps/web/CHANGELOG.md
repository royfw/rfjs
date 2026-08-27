# web

## 0.1.3

### Patch Changes

- 78451a2: Move the form-builder AI Assist panel above the Canvas/Preview/JSON tabs, matching
  table-builder / metadata-builder (AI panel above the tab strip) for a consistent
  tool layout.
- Updated dependencies [78451a2]
- Updated dependencies [78451a2]
- Updated dependencies [78451a2]
- Updated dependencies [78451a2]
- Updated dependencies [78451a2]
- Updated dependencies [78451a2]
- Updated dependencies [78451a2]
- Updated dependencies [78451a2]
- Updated dependencies [78451a2]
- Updated dependencies [78451a2]
  - @rfjs/es-query@0.1.1
  - @rfjs/data-filter@0.3.0
  - @rfjs/form-builder@0.1.1
  - @rfjs/filter-builder@0.2.0
  - @rfjs/flow-core@0.2.0
  - @rfjs/jwt@0.2.1
  - @rfjs/pg-filter@0.1.0
  - @rfjs/es-client@0.1.1
  - @rfjs/form-builder-ui@0.1.1
  - @rfjs/decision-table@0.1.1
  - @rfjs/filter-builder-ui@0.0.2
  - @rfjs/table-builder-ui@0.1.1

## 0.1.2

### Patch Changes

- 733d3c4: Consume ProtocolPanel from the new @rfjs/data-schema-ui package; the app-level shared component is removed (import-path-only change for metadata-builder and table-builder).
- 8d3709b: table-builder: resource-centric data source — one resource (± protocol) seeded by meta.json import / pasted rows / the sample; an offline-vs-live preview toggle replaces the memory/HTTP transport row, and the offline preview now queries the resource's own rows (fixes the imported-rows vs in-memory divergence). Adds a collapsible ToolIntro explainer to table-builder and metadata-builder.
- 10868db: Fix the restore-before-persist localStorage race in ToolIntro and metadata-builder: the persist effect's mount run fired with pre-restore defaults, transiently clobbering the stored value before the restore state landed. The persist effect now skips exactly its first run.
- 09d2a78: Studio visual sweep: table-builder, form-builder, flow-builder and bpmn-viewer
  now use the shared studio language (ToolEyebrow / ToolTabs / SectionCard /
  FragmentBar / ToolIntro), matching the metadata-builder reference. The two
  canvas tools (flow-builder, bpmn-viewer) gain studio chrome — a tab-strip /
  slab-framed card, controls in the card header, a gold status FragmentBar, and
  a ToolIntro — around the unchanged React Flow / bpmn-js surface.
- 394c162: Roll the collapsible ToolIntro explainer out to the remaining 15 web tools, and consolidate its control strings into shared central ToolUI keys (introQuestion/introExpand/introCollapse/introDismiss).
- 5f5ef7f: Unify the 15 showcase tools' shell visual language to the metadata-studio look: extract shared ToolEyebrow / SectionCard (solo + tab + collapsible) / ToolTabs, replace the hand-rolled section-card recipes (static and collapsible) and the duplicated tab bar, roll the eyebrow out to every tool, and flatten the ToolIntro wrap to a single column. Adds the D2 flourishes: tab-strip header + gold fragment bar on the compiled-query/eval outputs, and a dashed canvas around the filter-tree editors.
- Updated dependencies [a25b436]
- Updated dependencies [91936d5]
- Updated dependencies [0435d6b]
- Updated dependencies [246901f]
- Updated dependencies [f3fc709]
- Updated dependencies [add6efc]
- Updated dependencies [d5ec0f4]
- Updated dependencies [5e6f6ac]
- Updated dependencies [3b4cc8f]
- Updated dependencies [ddf2103]
- Updated dependencies [f2c1372]
- Updated dependencies [9fd56c7]
- Updated dependencies [1dac428]
- Updated dependencies [94d76d7]
- Updated dependencies [d246663]
- Updated dependencies [a42f73d]
- Updated dependencies [2dff4e6]
- Updated dependencies [f656b1a]
- Updated dependencies [4cac893]
- Updated dependencies [4cac893]
- Updated dependencies [1036caf]
- Updated dependencies [9bf3b3d]
- Updated dependencies [029af65]
- Updated dependencies [f2c1372]
- Updated dependencies [1aa5a4c]
- Updated dependencies [9855008]
- Updated dependencies [e8ff5da]
- Updated dependencies [696edef]
- Updated dependencies [48e6e74]
- Updated dependencies [39695f4]
- Updated dependencies [11a5caa]
- Updated dependencies [024eacb]
- Updated dependencies [8e37962]
- Updated dependencies [6ee5368]
- Updated dependencies [54b3b32]
  - @rfjs/ai-assist@0.1.0
  - @rfjs/ai-assist-ui@0.0.1
  - @rfjs/data-schema@0.1.0
  - @rfjs/data-schema-ui@0.1.0
  - @rfjs/decision-table@0.1.0
  - @rfjs/es-client@0.1.0
  - @rfjs/filter-builder@0.1.0
  - @rfjs/es-query@0.1.0
  - @rfjs/flow-core@0.1.0
  - @rfjs/form-builder@0.1.0
  - @rfjs/form-builder-ui@0.1.0
  - @rfjs/web-ui@0.1.0
  - @rfjs/table-builder-ui@0.1.0
  - @rfjs/jwt@0.2.0
  - @rfjs/pg-filter@0.0.1
  - @rfjs/table-builder@0.1.0
  - @rfjs/filter-builder-ui@0.0.1
  - @rfjs/web-core@0.0.1

## 0.1.1

### Patch Changes

- Updated dependencies [333b1b5]
- Updated dependencies [a72251f]
  - @rfjs/data-transform@0.1.1
  - @rfjs/object-utils@0.2.1
