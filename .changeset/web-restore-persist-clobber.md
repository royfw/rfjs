---
"web": patch
---

Fix the restore-before-persist localStorage race in ToolIntro and metadata-builder: the persist effect's mount run fired with pre-restore defaults, transiently clobbering the stored value before the restore state landed. The persist effect now skips exactly its first run.
