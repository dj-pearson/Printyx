<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# We need to do a deep dive into the Hubspot CRM function, I want to fully duplicate (minus the colorway as I will use my own branding and colors) how the Hubspot CRM looks and feels, so full layout on how they are able to easily manipulate at scale so if they have a list of filtered prospects how they change information easily without having to fully go into records to do so, the filtering system, the functions of the CRM components and where they are, what makes it great, the full UX, and anything else to duplicate the functions and layout of hubspots CRM

To clone HubSpot’s CRM UX for deals, design a kanban‑style pipeline board with configurable cards, powerful filtering + saved views, and bulk/inline editing that minimizes how often users open full records. Layer this on top of a clear object model (deals, contacts, companies, custom objects) and a record page that is heavily configurable per team and per user.[^1][^2]

***

## Core UX principles to mirror

HubSpot’s CRM UX is built around a few key ideas you’ll want to reproduce:

- **Object‑centric model with flexible layout:** Contacts, companies, deals, tickets, and custom objects all share the same basic index + board + record patterns, but each object can be customized (pipelines, board layout, record properties).[^3][^1]
- **Configuration first, extensibility second:** Most of the UX is configurable via settings (which properties show on cards, record sections, views, etc.), with a smaller layer of custom UI extensions for truly bespoke flows.[^1]
- **Work in context, not via page hopping:** Users can change deal stage by dragging cards, bulk‑edit properties from list/board, and trigger workflows so they rarely need to open each deal individually.[^4][^5][^6]

Design your clone so every “default” screen is configurable via metadata, and most actions happen in‑place on the board or list.

***

## High‑level navigation and IA

HubSpot’s main nav exposes CRM objects (e.g., CRM > Deals) and then drops users into an index page with multiple “views” as tabs. For deals, the primary toggle on that index is between **table view** and **board view** (pipeline).[^2][^7]

Within the deals index, HubSpot treats **saved views** as first‑class: each view is a tab with its own filters, column configuration, and sharing/visibility settings, and users can add more views via “Add view”. A dropdown on the board lets users switch pipelines, while the view tabs determine filters and layout presets for that pipeline.[^7][^2]

In your clone:

- Top‑level nav = CRM > Deals.
- Inside Deals:
    - View‑mode toggle (Table | Board).
    - Horizontal strip of view tabs (each = saved filter + layout profile).
    - Pipeline selector + “Board options” near top right of the board view.

***

## Deals pipeline board layout

HubSpot’s pipeline board is a classic kanban: columns represent deal stages within a selected pipeline, each holding a vertical stack of deal cards. At the top of each column, HubSpot shows a title (stage name) and aggregated metrics (commonly total deal amount in that stage), with options to simplify or configure how totals are displayed.[^8][^2]

Users select the pipeline and “view tab” they want to customize, then use “Board options > Edit board” to adjust per‑view settings like card content, column totals formatting, and other display preferences for that board. Pipeline‑level settings (add/remove/reorder stages, access control, tags, board/card customization entry points) live under Objects > Deals > Pipelines in the settings area, separate from the in‑context “Edit board” entry point.[^2][^8]

For your clone’s board:

- Top bar: pipeline dropdown, view tab strip, “Board options” menu.
- Columns: stage header, aggregate metrics, scrollable card stack.
- Each board is the composition of: selected pipeline + view definition + board/card config.

***

## Deal card design and customization

HubSpot lets admins and users customize which properties show on board cards, and whether changes apply “for myself” or “for everyone”. From the board, clicking a configure icon or “Edit board” opens a side panel with “Card setup”, where you choose up to N properties to show on cards, and optionally allow users to reorder/add a few personal properties.[^8][^2]

Cards commonly show deal name, amount, close date, owner, priority, and associated records, and HubSpot exposes a “card style” choice to show things like priority and associated records visually. Pipelines can also define “deal tags” — color‑coded labels that sit on cards to categorize deals (e.g., hot, at risk) and provide at‑a‑glance signal.[^9][^2][^8]

Blueprint for your cards:

- Card content layout (top to bottom): title, key numbers (amount, close date), pill tags, owner/avatar, icons for associations (company/contact).
- Card configuration model:
    - Global defaults per pipeline.
    - Per‑view overrides (for that view’s cards).
    - Per‑user tweaks (reorder, add 1‑2 extra fields) with a “for me” vs “for everyone” toggle.

***

## Filtering and saved views

HubSpot’s filtering model is: **ad hoc filters → saved as named views → views open as tabs.** At the top of the table/board, default property dropdowns (e.g., Contact owner, Create date, Lead status) act as quick filters, and a “More filters” panel lets users add more complex conditions across any property.[^10][^7]

Once filters are applied, “Save view” offers options: save (update existing), “Save as new view”, set visibility (private, team, everyone), and manage which views appear as tabs. A “+ Add view” control shows all saved views, and users can open them as tabs, rename, clone, delete, manage sharing, or export data from the view through an options menu.[^7]

To mirror this:

- Filter bar:
    - A few common property dropdowns inline.
    - “More filters” button → right‑side panel for advanced conditions builder.
- View model:
    - `View = {name, object, filterDefinition, sort, columns/boardConfig, visibility, defaultFor: [teams/users?]}`.
    - Tabs across top for open views; “+ Add view” for view picker/manager.
    - “Save view” with (Save, Save as new, Visibility, Default) semantics.

***

## Inline and bulk editing patterns

HubSpot is optimized to edit many records without drilling into each one. On list (table) views, users can select multiple records via checkboxes and then choose actions like edit property, assign owner, create tasks, add to lists, etc. In board view for deals and tickets, hovering over a card reveals a checkbox; once one card is checked, checkboxes appear on all cards, enabling multi‑select and bulk actions from the board as well.[^5][^6]

Bulk edit flows open a dialog where you choose “Property to update” and set a new value that applies to all selected records, with special handling for multi‑select properties (add/remove, not just overwrite). HubSpot also supports bulk updates through imports (CSV with IDs and properties) and workflows for higher‑end tiers, giving both manual and automated bulk‑change paths.[^6][^5]

Additionally, HubSpot lets users change certain properties directly from list/board: dragging a card between stages changes the deal stage, and the list view allows direct property editing in cells or via an “Edit” action for a specific field without opening the full record. From the deal record itself, the stage/pipeline picker is prominently placed so stage changes can happen from the record, board drag‑and‑drop, list bulk edit, or automation.[^4][^5]

Patterns to implement:

- **Selection:** checkboxes on rows/cards, “select all on page”, “select all in view”.
- **Bulk toolbar:** appears when >0 selected, offering “Edit property,” “Assign owner,” “Create task,” “Add to segment,” etc.
- **Inline cell editing:** click a cell → popover/dropdown to change that property for that record.
- **Drag between columns:** stage changes on drop, with optional confirmation or workflow triggers.

***

## Deal record page layout

HubSpot’s deal record layout is built for quick scanning and inline editing of key properties, with the ability to customize which properties appear where. At the top, the stage and pipeline selector is highly prominent so reps can change stage without going back to the board; below that, the record page is split into sections that can be reordered and configured (e.g., “About this deal”, “Deal information”, “Custom sections”).[^1][^4]

The center column is usually a timeline/activity feed: emails, calls, notes, tasks, logged activities, and associated records appear in chronological order, often with filters for activity types. Right‑hand sidebars host widgets/cards – some standard (associated contacts/companies, playbooks, attachments) and some custom UI extensions that can show external or custom object data in‑line, built with React‑based components.[^1]

For your clone, mirror this 3‑column mental model:

- Header: name, stage/pipeline, quick actions (log activity, email, task).
- Left (or top‑left): editable property groups, fully configurable via metadata.
- Center: timeline with filters and compose inputs.
- Right: pluggable “cards” region for associated entities and custom extensions.

***

## Custom objects and extensible UI

HubSpot’s “custom objects” feature lets teams define additional record types beyond contacts/companies/deals/tickets, and then use the same index/board/record UI patterns with them. This means your UX architecture should not special‑case deals too heavily; it should be a generic object view system where each object type can opt into pipelines/boards, custom card layouts, and record page layouts.[^3][^1]

On top of configuration, HubSpot offers UI extensions that are small React frontends + serverless functions embedded as cards inside record pages and other CRM surfaces. These extensions can read/write CRM data and external system data, letting customers build highly specific flows (e.g., renewals, quoting) without leaving the CRM.[^1]

To parallel this:

- Treat “object type” as a first‑class dimension.
- Let each object define: whether it has pipelines, which properties can show on cards, which record layout template to use.
- Define a plugin/extension surface on record pages / sidebars where custom micro‑apps can live.

***

## Desktop vs mobile behavior

HubSpot’s docs and public materials focus more on desktop, but the patterns adapt well to mobile: a pipeline board becomes either a horizontally scrollable column set with vertically scrolling cards, or a filtered list where the “column” is chosen via a dropdown. Actions that are hover‑based on desktop (checkbox on hover, configure icon) should be converted to explicit buttons or overflow menus on mobile.[^2][^7]

For your implementation:

- Mobile deals index:
    - Primary view = list of deals with key properties.
    - Secondary affordance = stage filter (or pipeline + stage), plus a simplified “board” that scrolls horizontally between stages if needed.
- Bulk actions: allow multi‑select via long‑press or “Select” mode.
- Record page: stack columns vertically (header, properties, timeline, side cards) with collapsible sections.

These are design choices for your clone rather than HubSpot‑specific guarantees, so they can be adapted to your audience.

***

## Key UX components and implementation notes

Here is a compact mapping of the UX building blocks you should implement:


| UX piece | What HubSpot does | What to build in your clone |
| :-- | :-- | :-- |
| Deals index views | Tabs for saved views with filters + layout per view.[^7] | `View` model, tab strip, view manager (create, clone, share, default, export). |
| Board vs table | Board for pipeline, table for grid editing.[^2][^5] | Common query + filter layer feeding two renderers (kanban, table). |
| Pipeline \& stages | Separate pipeline settings, per‑pipeline stages.[^8] | Pipeline admin UI with stage CRUD, order, access, board/card defaults. |
| Board card config | Configure card properties per pipeline/view/user.[^2] | Card schema editor; allow global + per‑view + per‑user overrides. |
| Aggregates on columns | Show simplified stage totals on columns.[^2] | Column header metrics config (sum, count, weighted, etc.). |
| Filtering + More filters | Quick filters + advanced filter panel.[^10][^7] | Filter bar + right‑side filter builder; persists as part of view definition. |
| Saved views | Save/clone/rename/share views; tabs for open views.[^7] | Full lifecycle for views (CRUD + visibility + ordering + default flags). |
| Bulk editing | Select rows/cards, bulk edit properties.[^5][^6] | Selection model + bulk action toolbar + multi‑property bulk edit dialogs. |
| Inline editing | Direct property edits and drag‑to‑change‑stage.[^4][^5] | Click‑to‑edit cells; drag‑and‑drop stage changes hooking into data + automation layer. |
| Record layout config | Customizable sections on record; stage picker on top.[^4] | Layout editor that orders property groups and widgets; top‑fixed stage control. |
| UI extensions | Embedded React cards hitting internal/external data.[^1] | Extension SDK for custom cards on record pages and possibly index sidebars. |


***

## Practical build strategy

Given you’re targeting production and both desktop + mobile:

1. **Define a generic object schema and view system**
    - Objects: deals, contacts, companies, tickets, custom.
    - Views: store filters, sort, columns/boardConfig, visibility, default flags.
    - Pipelines: per‑object pipelines with stages, tags, access rules.[^8]
2. **Implement the index shell once, then plug in board/table renderers**
    - Shared top bar: object selector (implicit), view tabs, filter bar, Save view, “+ Add view”.[^7][^2]
    - Renderer area: switch between board and table.
3. **Build the kanban board with strong selection + DnD**
    - Columns from stages; cards from query; DnD to move stages.
    - Checkbox‑based multi‑selection with a floating bulk‑action bar.[^5][^6]
4. **Design the record page as a layout engine, not a fixed form**
    - Layout metadata that defines sections, property groups, and embedded widgets.[^4][^1]
    - Support team‑based templates so different roles see different layouts.
5. **Add configuration UIs mirroring HubSpot’s two levels**
    - Global admin setup (Objects > Deals > Pipelines, properties, layouts).[^8]
    - In‑context configuration (Edit board, Card setup, Customize record) for power users.[^2]
6. **Reserve a plugin surface for future extensibility**
    - Even if you do not ship full UI extensions on day one, stub a “custom card” slot on record pages and boards; later you can let power users mount micro‑apps similar to HubSpot’s React extensions.[^1]

Follow this blueprint and you will get extremely close to HubSpot’s functional layout and UX patterns for the deals CRM, while still using your own branding and front‑end stack.
<span style="display:none">[^11][^12][^13][^14][^15]</span>

<div align="center">⁂</div>

[^1]: https://www.youtube.com/watch?v=A3Ot7WvdVZM

[^2]: https://knowledge.hubspot.com/object-settings/select-properties-to-show-on-records-in-board-view

[^3]: https://impulsecreative.com/blog/hubspot-custom-objects-deep-dive

[^4]: https://community.hubspot.com/t5/CRM/how-to-edit-deal-layout/m-p/645861

[^5]: https://www.iv-lead.com/hubspot-by-iv-lead/bulk-edit-records-in-hubspot

[^6]: https://knowledge.hubspot.com/records/bulk-edit-records

[^7]: https://www.streamcreative.com/migration/knowledge/filter-records-hubspot-crm

[^8]: https://knowledge.vested.marketing/knowledge/setting-up-customizable-deal-pipelines-and-deal-stages

[^9]: https://www.youtube.com/watch?v=mD0QEmSspXc

[^10]: https://www.youtube.com/watch?v=ZJbTVwkQnxo

[^11]: https://www.youtube.com/watch?v=LJRzMGKbjuI

[^12]: https://community.hubspot.com/t5/Account-Settings/Customize-Internal-Appearance-of-Hubspot/m-p/859580

[^13]: https://theartofbusinesstech.com/p/deep-dive-into-hubspot-25

[^14]: https://community.hubspot.com/t5/HubSpot-Ideas/EASY-EDIT-of-property-values-inside-Hubspot-LIST-View-kinda-like/idi-p/961552

[^15]: https://knowledge.hubspot.com/design-manager/structure-and-customize-template-layouts

