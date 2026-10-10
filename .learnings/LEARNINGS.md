## 2026-09-14 — correction
Priority: high
Status: resolved
Do not equate build success with working UI. Reproduce addition, late-hour placement, short tasks, blocked schedules, future dates, drag persistence and reload through UI before claiming verified. Preserve local data. Report limitations honestly. Added scheduler regression tests and isolated Timeline/Scheduler modules.

## 2026-09-16 — correction
Priority: high
Status: resolved
Replaced monolithic JSX and cumulative CSS patches with App/model/repository and active components. Verified real browser drag/resize and mobile date editing. Found native date/time filling did not reliably commit onChange; added onInput and retested persistence. Preserve original localStorage key on migration. Do not assert complete third-party product parity based on compilation alone.
