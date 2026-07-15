---
"@rfjs/ai-assist": minor
---

Extract the BYOK edit-time AI capability layer into a publishable,
framework-free package: `AiSettings`/`AiError`/`AiClient` types, an
OpenAI-compatible client with `complete` + SSE `stream` + `listAiModels`, an
`AuthStrategy` abstraction (`apiKeyAuth`/`noAuth`; OAuth shape reserved), an
injectable `AiStorage` with a browser default, `settings`/`createAiLog`
persistence, a framework-agnostic `createAiProxyHandler`, and an opt-in
transport `RetryPolicy` (default off). BYOK behavior is unchanged.
