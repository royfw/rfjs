---
'@rfjs/filter-builder-ui': patch
'@rfjs/form-builder-ui': patch
---

Add the missing `"use client"` directive to the React hook modules (`useFilterTree`, `useConfigBuilder`, `useContainerBreakpoint`, `useDataSource`, `useSignatureCapture`). Importing these through a package barrel from a React Server Component (e.g. workbench's dataset explorer page) failed the Turbopack production build.
