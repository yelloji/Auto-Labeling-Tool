# Lessons — Rules from User Corrections

## Always explain before coding
Always explain what will change, why, and what could break before making any code change.
**Why:** User wants to understand and trust every change before it happens.

## No co-author in commits
Never add "Co-Authored-By: Claude" lines to commit messages.
**Why:** User explicitly asked to remove it.

## No emojis
Never use emojis in code, commits, docs, or responses.
**Why:** User preference — keep everything professional and clean.

## One thing at a time
Do not batch unrelated changes together. One fix per commit when possible.
**Why:** Easier to review, trace, and revert if needed.

## Device selection for prediction/validation is automatic
prediction and validation auto-detect GPU/CPU — do not expose device as a user setting.
Training is the only place where user manually selects device.
**Why:** User intentionally removed device UI — it should be automatic.

## Do not mock database in tests
Always use real database for tests.
**Why:** Prior incident where mock/prod divergence masked a broken migration.
