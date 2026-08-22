# Manufacturer meter-collection adapters

`base-adapter.ts` plus the Canon, Xerox, HP and FMAudit clients: ~1,970 lines of
per-manufacturer API code that authenticates, lists devices and pulls meter
readings, normalising each vendor's response into `CollectionResult`.

**These have no caller today.** Their only consumer was
`server/services/unified-meter-collection-service.ts`, which was deleted along
with `server/services/manufacturer-integration-service.ts` (QUALITY-002). Both
were written against columns that do not exist — `device_metrics.metricType` and
`.measurementTimestamp`, `manufacturer_integrations.nextCollectionAt` and the
whole rate-limit group — so neither could have run, and neither had an importer
outside the pair.

They are kept rather than deleted with the orchestrator because they are
correct: they typecheck clean, they carry real vendor protocol knowledge, and
rebuilding them from vendor documentation would be the expensive part of wiring
meter collection up properly.

## If you wire these up

The live integration service is `server/manufacturer-integration-service.ts` —
note the path. There were TWO files with that basename, one here and one in
`server/`, and they were not copies: the `server/` one is imported by
`routes-manufacturer-integration.ts` and is correct, while the one here was
broken. A relative `./manufacturer-integration-service` import resolved to
whichever sat beside the importing file, which is how the broken copy stayed
wired to the deleted orchestrator while the routes used the good one. Import the
`server/` one explicitly.

The real columns are in `shared/manufacturer-integration-schema.ts`:
`device_metrics` is a WIDE row (`collectionTimestamp`, `totalImpressions`,
`bwImpressions`, `colorImpressions`, `tonerLevels`, …), not a key/value metric
table — the deleted code queried it as if it were, which is the mismatch that
cannot be fixed by renaming a column.
