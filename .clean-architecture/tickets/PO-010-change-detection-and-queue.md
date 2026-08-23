# [PO-010] Vault change detection and the push queue

**Status**: Not Started
**Priority**: High
**Effort**: M
**Category**: feature
**Created**: 2026-08-23

## Description

Notice when the user changes a synced note, and hold those changes in one queue that Papera
can absorb. This ticket detects and queues. PO-011 sends.

A bulk edit is the case that matters. A find-and-replace across a vault fires one `modify`
event per file, so the queue needs a concurrency cap.

**Warning**: the plugin's own pull writes fire the same vault events as a user edit. Without
a marker, a pull enqueues every note it just wrote and pushes it straight back.

## Acceptance Criteria

- [ ] The plugin subscribes to `modify`, `create`, `delete` and `rename` on the vault.
- [ ] An event for a path outside the reserved root is discarded before anything else runs.
- [ ] A change to one file waits 2 seconds after the last event for that file before it queues.
- [ ] One global queue holds every pending change.
- [ ] The queue runs at most a fixed number of pushes at a time.
- [ ] A find-and-replace across 500 synced notes queues 500 changes and never exceeds the cap.
- [ ] A write the plugin made itself does not enter the queue.
- [ ] The queue survives a sync error on one item and continues with the rest.
- [ ] The plugin shows how many changes are pending.
- [ ] Closing the vault with pending changes does not lose them, or the plugin warns the user.

## Implementation Steps

1. **Subscribe**: the plugin registers the four vault event handlers on load, after the index loads.
2. **Scope filter**: each handler calls the PO-004 scope check first.
3. **Self-write marker**: the plugin records the paths it writes, so its own events are ignored.
4. **Debounce**: each file has its own 2 second timer, reset by each new event for that file.
5. **Queue**: one queue holds the debounced changes, with a concurrency cap on the workers.
6. **Error handling**: a failed item is recorded and does not stop the queue.
7. **Status**: the pending count is visible to the user.

## Decisions

- **Debounce per file, cap globally.** A per-file debounce stops one note pushing on every keystroke. A global cap stops a bulk edit flooding the API.
- **The scope check runs first, in every handler.** A user's own note must never reach the queue.

## Technical Notes

### Architectural Considerations

- **A rename is one event, not a delete plus a create.** Obsidian reports it as a rename with the old path, and the plugin must keep it that way. PO-012 owns what a rename means.
- **Obsidian's `.trash/` sits outside the reserved root.** A delete into the local trash arrives as a rename out of scope. PO-012 owns that case, and this ticket must not discard the event before PO-012 sees it.

## Testing

- **Unit**: the scope filter; the per-file debounce; the queue's concurrency cap; the self-write marker; the error path.
- **E2E**: edit a synced note and confirm one queued change after 2 seconds.
- **Manual**:
  - [ ] Run a find-and-replace across 500 synced notes and confirm the cap holds.
  - [ ] Edit a note outside the reserved root and confirm nothing queues.

## Related

- Related Tickets: PO-004 (the scope check), PO-011 (which drains the queue), PO-012

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket.
