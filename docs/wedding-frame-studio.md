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
