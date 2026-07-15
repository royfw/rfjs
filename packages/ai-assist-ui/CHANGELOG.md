# @rfjs/ai-assist-ui

## 0.0.1

### Patch Changes

- 91936d5: Add the private React layer over `@rfjs/ai-assist`: the `useAiAssist` hook
  and the `AiPanel` shell (labels-as-props, no i18n framework coupling),
  consumed via Next.js transpilePackages.
- 0435d6b: Align the `AiPanel` collapsible header with the studio `SectionCard` slab language
  (`bg-muted/30` · `px-4 py-2.5` · `border-b` when open) and give the collapse chevron
  its own segment (`gap-3` from the sparkle+title cluster) so the arrow no longer reads
  as cramped against the icon.
- Updated dependencies [a25b436]
- Updated dependencies [d246663]
- Updated dependencies [6ee5368]
- Updated dependencies [54b3b32]
  - @rfjs/ai-assist@0.1.0
  - @rfjs/web-ui@0.1.0
