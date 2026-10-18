# PhotoToast Wedding Frame Studio

## First version
Open `/frame-studio` (also linked from admin layout management). Enter names, optional date, heading, name font and accent. Compare three templates, optionally load three local photos. Download a transparent PNG, a photo composite or a PhotoToast layout JSON. In an existing **2x6** layout editor, import the JSON, review, then save using the existing save action. Imported overlay contains rasterized text so clients do not need the fonts. Import replaces the current editor's slots/layers/test photos; persisted previews remain unchanged. No new cloud service, paid API, deployment or printing is invoked by the studio. Photos stay in browser memory.

Canonical dimensions: 600×1800px, 2×6 inches at 300ppi. PNG browser export has browser-default resolution metadata; configure printer by physical size, not PNG metadata. All slots: 528×396px, x=36, y=102/534/966. 36px outer horizontal safety area, 36px photo gaps. Final clearRect guarantees transparent holes even when ornaments change. Printer-specific bleed/cut must be test-printed.

## Art direction and Happy Case
Happy Case: names → three ready-made frames → select → transparent PNG/layout export → import into 2x6 editor → review/save.
Emotional target: quiet keepsake. No stock, generated or third-party template artwork included.
Candidates (fit/clarity/distinctiveness/feasibility/accessibility/reuse; 1–5):
- Invitation atelier: spacious editorial, sage/ivory, fine borders, user photographs, Myeongjo + system UI, Allura only in printed headings. 5/5/4/5/4/5. Selected: matches supplied invitation, exposes three physical strips as the core interaction.
- Photo archive: dense index, monochrome, sans-serif numbering, thin rules, contact-sheet photographs. 3/5/4/5/5/4. Weaker connection to the invitation.
- Botanical stationery: object-led leaf illustrations, green/paper palette, Myeongjo, organic corners, fade transition. 4/4/4/4/4/4. Too decorative as the overall application; a restrained leaf is one frame variant only.
Motion: subtle selection background only; reduced-motion override. Three fixed templates are labeled honestly, not AI-generated custom results. UI sizes/dimensions derive from source constants. No invented popularity claims. Actual wedding date stays empty until entered.

## Fonts
Downloaded unmodified from Google Fonts, OFL 1.1, licenses bundled next to binaries:
- Nanum Myeongjo Regular: https://github.com/google/fonts/tree/main/ofl/nanummyeongjo
- Allura Regular: https://github.com/google/fonts/tree/main/ofl/allura
No system font installation needed. Korean heading fallback uses Myeongjo; Allura is Latin calligraphy. Serif name option is deterministic across devices; sans option uses device sans-serif.

## Verification
TypeScript noEmit passed. Browser QA: 1440px desktop, 390px phone; name edits, blank-date default, missing photos validation, local photo uploads, preview and JSON downloads, empty name validation, long mixed-script names, no page errors, no mobile document overflow. All 1,881,792 slot pixels across three PNGs checked for alpha=0. PNGs verified 600×1800. Post-render revision: phone previews were too small and font-select label clipped; changed comparison to horizontal scroll with 170px cards and made font selector full width. Re-rendered after revision.

## Limits
Template-driven first version, not reference-image extraction or arbitrary AI generation. Photo crop is centered; custom crop and multi-event accounts/billing are future scope. No physical print verified. The new local studio needs no account; existing admin editor and storage behavior remain as configured in the application. No database writes or cloud uploads were performed in QA.

## Collection expansion
Expanded to 15 original templates (12 additions), retaining all canonical photo geometry. Categories: minimal 4, typography 4, line drawing 4, natural 3. Category selection moves the active selection to the first visible template if needed; chosen design remains the export source. No new fonts, third-party art, generated images or services. Browser QA verified 9,408,960 photo-hole pixels across all 15 templates, all category filters, selected JSON export, desktop 1440px/mobile 390px and no page errors or mobile overflow. Visual review found the monogram seal too close to the last photo; reduced its radius and lowered it to add breathing room, then re-rendered. Physical print remains unverified.

## Direct event registration and proposals
The studio has two explicit publish actions, both restricted to existing admin authentication:
1. `/api/wedding-layouts`: validates the chosen event, normalizes a 600×1800 PNG, cuts canonical 528×396 holes again on the server, and creates one complete layout in the existing database. Overlay is embedded in the layout document, avoiding a separate upload and orphaned/temporary image files. Existing booth layout selection stays with the event administrator.
2. `/api/frame-proposals`: accepts 1–15 ordered template snapshots and small completed sample previews. The user must choose three photos and explicitly click Create Proposal. It stores names, design settings, PNG overlays and 240×720 JPEG previews in the existing database. No new paid API or object storage was introduced or invoked during QA.

`/frame-proposals/<random 144-bit token>` displays numbered sample + transparent frame pairs, downloads and a saved design selection. The link grants viewing and changing that proposal selection. Search engines are excluded through noindex/nofollow metadata, and referrer policy is no-referrer. There is no automatic notification; the sender checks the same link for the saved choice. The proposal is an immutable design snapshot; selection can be changed. Link revocation/history and expiration are not yet implemented.

Verification: `node scripts/test-wedding-publishing.cjs` exercises actual route handlers with in-memory model/database substitutes: auth enforcement, event validation, canonical slots, every server-cleared pixel, proposal validation/create/read, valid selection persistence and rejection of a selection outside the proposal. Browser QA mocked external responses only: event registration, missing-photo validation, photo uploads, custom order, proposal creation, desktop/mobile shared page, selection save/reload; no real event/database/cloud writes. Visual revision: selection action was too far below a long mobile proposal; anchored the mobile choice/save bar to the viewport and added clearance.

## Concept range: 30 templates
Added 15 concepts beyond classic wedding stationery: film, admission ticket, newspaper, real-date calendar, butter checkerboard, cobalt studio, terracotta, postcard, typewriter, waves, silver sparkle, dusty rose typography, contour lines, museum label and color field. Categories now include vintage and graphic. Concept palettes can be restored after manual color changes; dark film/deep green keep light lettering. Calendar renders the supplied date only, with a date-free calligraphic fallback. No wedding date is inferred.

Proposal count derives from the collection constant (30); existing 3.5MB request cap remains. API tests cover a full collection snapshot, palette preservation and rejection above the allowed count. Studio canvas previews are now 240×720, reducing retained preview pixel memory by 84%; exports/registration overlays remain 600×1800. Browser QA downloaded all 30 actual PNG exports, checked 18,817,920 hole pixels, all six category filters, mobile overflow and a calendar with explicit QA input. Visual review: constrained long museum-label names within the label column before re-rendering.

## Proposal sample fidelity fix
New proposals store three shared photos cropped once to canonical 528×396 photo slots, JPEG quality .96, and preserve those bytes on the server without another encode. Every design's immutable PNG overlay is composited at 600×1800 in the viewer and downloaded as lossless PNG. Rendering starts near the viewport to avoid decoding all 30 full-size composites at once. This avoids duplicating/recompressing each sample and keeps the 3.5MB publish cap. Existing proposals with 240×720 JPEG samples remain readable but need to be recreated from original photos for improved quality; missing source detail cannot be recovered. API regression tests cover the new shared-photo format, byte preservation and legacy previews.

## Proposal image viewer
Both completed samples and transparent overlays open in a native modal dialog. Fit-to-screen shows the whole strip; image click or the original-size button switches to the 600px-wide source with scrolling. Escape, close button and backdrop dismiss it. Native modal focus containment plus explicit focus restoration and body scroll locking keep keyboard/mobile behavior intact. Transparent frames retain checkerboard backing. Browser QA covered sample/frame opening, source-size width, Escape, close, backdrop, focus restoration and 390px mobile rendering, with no page errors.

## Booth welcome gallery
Removed the single-layout SVG fallback from the booth welcome screen. The initial wall is seeded from the selected layout's saved complete previews, with duplicate URLs removed and the configured samples/prints/mixed source respected. Recent/mixed photos continue to refresh in the same wall every 30 seconds. If no initial preview exists, only a short loading/empty message is displayed until photos arrive; no single-frame-then-gallery transition. Event and selected-layout data are revealed together to avoid an intermediate unconfigured welcome. `node scripts/test-booth-welcome.cjs` verifies the initial gallery render, URL deduplication and absence of the single-frame placeholder.
