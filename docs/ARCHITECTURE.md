# Architecture

This document explains how a request travels through PiCollection, and walks
through the two most common maintenance tasks: adding a new tagging entity
(like Tag/Character/Series/Artist) and adding a new field to an existing one.
It assumes you're comfortable with TypeScript and basic SQL, but nothing else.

## The layers

Electron's renderer (the React app, sandboxed, no Node/filesystem access)
never touches the database directly. Every read or write crosses into the
main process over IPC:

```
React component
  -> hook (useTags, useMediaQuery, ...)      src/renderer/src/hooks/
  -> window.api.<entity>.<method>(...)       src/preload/index.ts
  -> ipcRenderer.invoke(channel, payload)    -------- IPC boundary --------
  -> ipcMain.handle(channel, ...)            src/main/ipc/<entity>.handlers.ts
  -> zod validation (ipcHandler wrapper)     src/main/ipc/helpers.ts
  -> service (business logic, DB<->model mapping) src/main/services/<entity>.service.ts
  -> repository (Kysely queries only)        src/main/database/repositories/<entity>.repository.ts
  -> SQLite
```

A few things worth knowing before you touch any of this:

- **Channel names and validation schemas are the single source of truth** in
  [`src/shared/ipc/contracts.ts`](../src/shared/ipc/contracts.ts) (the `IPC`
  map and the zod `*Schema` exports). Both `src/main/ipc/*.handlers.ts` and
  `src/preload/index.ts` import from here — if you add a channel, add it to
  `IPC` first, then wire up the handler and the preload method by hand. There
  is no code generation; consistency is only as good as this being kept in
  sync in both places.
- **Repositories only know SQL.** They take/return the raw DB row shape
  (snake_case columns, `0`/`1` for booleans, epoch `number` timestamps) as
  defined in [`src/main/database/schema.ts`](../src/main/database/schema.ts).
  They never see a `*Model` type.
- **Services own the mapping** between DB rows and the camelCase, boolean-typed
  `*Model` shapes in [`src/shared/models/`](../src/shared/models/) that the
  rest of the app uses. This is also where cross-entity rules live (e.g.
  validating that an `artistId` passed into `media:create` actually exists).
- **`src/shared/`** is imported by both the main process and the renderer
  (enforced by the `@shared/*` path alias in both tsconfigs) — models, IPC
  contracts, and the gallery search-query parser live there. If a type or
  pure function is needed on both sides of the IPC boundary, it belongs here,
  not duplicated.
- **Every IPC handler is wrapped in `ipcHandler(schema, fn)`**
  ([`src/main/ipc/helpers.ts`](../src/main/ipc/helpers.ts)), which validates
  the incoming payload with zod and always resolves to an `IpcResult<T>`
  (`{ success: true, data } | { success: false, error }`) instead of
  throwing across the IPC boundary. Renderer code always checks
  `result.success` rather than using try/catch.
- **Schema changes are migrations, not edits to existing migration files.**
  Once a migration has shipped, treat it as immutable — add a new one, even
  for a one-column change. See `src/main/database/migrations/0003_media_ai_generated.ts`
  for the smallest possible example (adds `media.is_ai_generated`).
- **Not everything is request/response.** The auto-updater is the one place
  main pushes to the renderer unprompted, over a dedicated `updater:event`
  channel (`ipcRenderer.on`, not `invoke`) — see
  [`docs/auto-update.md`](auto-update.md) and
  `src/renderer/src/hooks/useAppUpdater.ts` for how the renderer subscribes.

## Worked example 1 — adding a new field to `Media`

Say you want to add a numeric `rating` (0-5) to media. This mirrors how
`isAiGenerated` (migration `0003`) was added — that migration plus the four
files below are a complete, working reference to diff against.

1. **Migration** — `src/main/database/migrations/0004_media_rating.ts`
   (create with `npm run migrate:create media_rating`, then fill in):

   ```ts
   import { Kysely } from 'kysely'

   export async function up(db: Kysely<any>): Promise<void> {
     await db.schema
       .alterTable('media')
       .addColumn('rating', 'integer', (col) => col.notNull().defaultTo(0))
       .execute()
   }

   export async function down(db: Kysely<any>): Promise<void> {
     await db.schema.alterTable('media').dropColumn('rating').execute()
   }
   ```

   Register it in `src/main/database/migrations/index.ts`:

   ```ts
   import * as m0004MediaRating from './0004_media_rating'
   // ...
   '0004_media_rating': m0004MediaRating
   ```

2. **DB row type** — add `rating: number` to `MediaTable` in
   `src/main/database/schema.ts`.

3. **Shared model** — add `rating: number` to `MediaModel` (and `MediaInput`
   if it's settable at creation time) in `src/shared/models/Media.ts`.

4. **IPC schema** — add `rating: z.number().int().min(0).max(5)` to
   `MediaInputSchema` in `src/shared/ipc/contracts.ts`. Any payload missing it
   (or out of range) is now rejected before it reaches the service.

5. **Service mapping** — in `src/main/services/media.service.ts`, add
   `rating: row.rating` to the row-\>model mapper, and `rating: input.rating`
   wherever a row is inserted/updated (mirror the existing
   `is_ai_generated: input.isAiGenerated ? 1 : 0` lines — no conversion
   needed here since `rating` is already a plain number both sides).

6. **Renderer** — read `media.rating` wherever you render `MediaModel`
   (`src/renderer/src/components/Media.tsx`), and add a control for it to
   `src/renderer/src/pages/Media/MediaForm.tsx` (the single form used for both
   create and edit), following the pattern of the existing `isAiGenerated`
   checkbox.

7. Run `npm run typecheck` — because `MediaModel`/`MediaInput` are shared
   types, every place that now needs to account for `rating` (form defaults,
   test fixtures, etc.) shows up as a compile error rather than a runtime bug.

## Worked example 2 — adding a new tagging entity

`Tag` is the simplest existing entity (just an `id` + `name`, no aliases, no
relations beyond `media_tag`) and is a good template to copy. Say you want to
add a `Location` entity, taggable on media the same way.

1. **Migration** — new table plus the media junction table:

   ```ts
   export async function up(db: Kysely<any>): Promise<void> {
     await db.schema
       .createTable('location')
       .addColumn('id', 'text', (col) => col.primaryKey())
       .addColumn('name', 'text', (col) => col.notNull().unique())
       .addColumn('created_at', 'integer', (col) => col.notNull())
       .execute()

     await db.schema
       .createTable('media_location')
       .addColumn('media_id', 'text', (col) => col.notNull().references('media.id').onDelete('cascade'))
       .addColumn('location_id', 'text', (col) => col.notNull().references('location.id').onDelete('cascade'))
       .addPrimaryKeyConstraint('media_location_pk', ['media_id', 'location_id'])
       .execute()
     await db.schema.createIndex('idx_media_location_location').on('media_location').column('location_id').execute()
   }
   ```

   (See `0002_series.ts` for the full pattern including the `down()` half and
   a second junction table — `Location` only needs one, to `media`.)

2. **Schema types** — in `schema.ts`, add `LocationTable`/`MediaLocationTable`
   and register both in the `DB` interface.

3. **Repository** — `src/main/database/repositories/location.repository.ts`,
   copy `tag.repository.ts` verbatim and rename (`findAllLocations`,
   `insertLocation`, `updateLocation`, `deleteLocation`).

4. **Shared model** — `src/shared/models/Location.ts`, copy `Tag.ts`
   (`LocationModel { id, name }`, `LocationInput { name }`), export it from
   `src/shared/models/index.ts`.

5. **Service** — `src/main/services/location.service.ts`, copy
   `tag.service.ts` and rename.

6. **IPC contract** — in `src/shared/ipc/contracts.ts`: add
   `LocationInputSchema` (copy `TagInputSchema`), `LocationUpdateSchema =
   UpdateByIdSchema(LocationInputSchema)`, and a `location` block in `IPC`
   with `getAll`/`create`/`update`/`delete` channel names
   (`db:location:get-all`, etc., following the existing naming convention).

7. **IPC handlers** — `src/main/ipc/location.handlers.ts`, copy
   `tag.handlers.ts` and rename; then call `registerLocationHandlers()` from
   `src/main/ipc/registerIpcHandlers.ts`.

8. **Preload** — add a `location` block to the `api` object in
   `src/preload/index.ts`, mirroring the `tag` block.

9. **Wire it into media** — if `Location` should be settable on media (like
   `tagIds`), extend `MediaInputSchema`/`MediaFiltersSchema` with
   `locationIds`/`locationGroups`, add `media_location` handling to
   `media.repository.ts` (copy how `media_tag` is joined/filtered) and to
   `media.service.ts`'s row assembly, and add `LocationModel[]` to
   `MediaModel`.

10. **Renderer** — a `useLocations()` hook (copy `useTags` from
    `src/renderer/src/hooks/useEntityLists.ts`), and a `LocationsManager.tsx`
    component (copy `TagsManager.tsx`) added as a new tab in
    `src/renderer/src/pages/Manage/ManagePage.tsx` (it renders
    Artists/Tags/Characters/Series as tabs of one "Metadata" page, not separate
    routes — add `'locations'` to the `ManageTab` union, a tab button, and a
    `<div hidden={tab !== 'locations'}>` panel next to the existing ones). Add
    a `MultiSelectAutocomplete` field to `MediaForm.tsx` and the gallery
    `FilterBar` if it should be filterable, following the existing Tags wiring
    in both.

11. Run `npm test` — `src/main/services/tag.service.test.ts` is a template for
    the new entity's own service test (`media.repository.test.ts` is a
    heavier example, for entities with their own complex query logic).
    Nothing here requires an Electron runtime to test: `initTestDbSingleton()`
    in `src/main/database/testHelpers.ts` spins up a real temporary SQLite
    file per test, migrated the same way the app migrates on startup.

## Where things live, at a glance

| Concern | Path |
|---|---|
| DB row shapes | `src/main/database/schema.ts` |
| Migrations | `src/main/database/migrations/*.ts` (+ `index.ts` registry) |
| SQL queries | `src/main/database/repositories/*.repository.ts` |
| Business logic, row<->model mapping | `src/main/services/*.service.ts` |
| IPC channel names + zod schemas | `src/shared/ipc/contracts.ts` |
| IPC handlers | `src/main/ipc/*.handlers.ts` (registered in `registerIpcHandlers.ts`) |
| Renderer-facing API surface | `src/preload/index.ts` |
| Cross-boundary types | `src/shared/models/*.ts` |
| Data-fetching hooks | `src/renderer/src/hooks/*.ts` |
| Gallery search parser | `src/shared/query/searchQuery.ts` |
| Pages/components | `src/renderer/src/pages/`, `src/renderer/src/components/` |
| Auto-update | `src/main/updater/` (see [`docs/auto-update.md`](auto-update.md)) |
| SauceNAO tag suggestions | `src/main/services/sauceNao.*.ts` — the only module making outbound network calls for user content, and only on an explicit button press (see `src/renderer/src/pages/Media/MediaForm.tsx`) |
