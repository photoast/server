# Wedding keepsake album

Happy case: the operator opens an event, enters the couple's cover title and wedding date, creates the gift link, and shares it with the couple; on mobile they see their actual wedding frame, open the memories, enlarge a strip and save the original image.

## Art direction

Reaction: a thoughtful paper gift. Existing ivory/sage wedding frame is the source of the visual language. No new imagery or external fonts are needed; Nanum Myeongjo and Allura are already hosted locally, with system Korean sans for controls. Original full-frame photos use contain rather than cropped faces. Shadows and slight rotations suggest loose prints; the line heart echoes the supplied frame. No required animation; reduced-motion users get instant scrolling.

Three directions (fit / clarity / distinction / feasibility / accessibility / reuse; out of five):

| Direction | Concept and first frame | Scores |
| --- | --- | --- |
| Paper keepsake — selected | Quiet affection; ivory paper, sage ink, loose framed strips, heart seal. Serif names + script title, wide editorial spacing, fine rules, restrained shadows. Cover opens into the real gallery. | 5 / 5 / 4 / 5 / 5 / 5 |
| Botanical letter | Garden calm; larger sage fields, fine line foliage and a sealed letter. Same Korean serif and sans, envelope-first composition and fold motion. More decorative imagery than the task needs. | 4 / 4 / 4 / 4 / 4 / 4 |
| Evening contact sheet | Intimate cinema; charcoal background, cream numbers, tightly set chronological strips and fade transitions. System sans with serif captions. Clear photographs, weaker match to today's light wedding frame. | 3 / 5 / 4 / 5 / 4 / 4 |

## Data ledger and behavior

- Title and optional date are supplied by the operator. No guessed wedding date or names are stored.
- Cover uses up to three distinct registered completed previews from the event's current booth layout; if absent, loaded photos provide the cover.
- Gallery reads only the token's event. Grouping by original `imageUrl` collapses repeated print/reprint jobs. This does not detect independently uploaded identical image files at different URLs.
- All registered completed preview URLs are excluded from the guest gallery, even if printed. Failed/refunded jobs are excluded. Test-printer captures in DONE are included because they may contain real guest photos.
- Count is the Mongo aggregation's distinct-photo count, not print quantity or attendee count.
- Pages load 48 distinct photos at a time; each loaded set is shuffled locally. Reshuffle operates on the loaded photos, without duplicating them. Original images retain their resolution and frame.
- Operator-only generation and retrieval reuse the existing admin authentication. A 192-bit bearer link allows read-only access without guest login. Link possession grants photo access; the UI explains this. No-index, no-referrer and no-store responses reduce accidental indexing/caching; the link is not a password.
- The public payload includes title/date/cover/photo IDs and URLs/count/pagination only. No email, auth code, payment or device metadata is returned. There is no payment or printing action in the public album.
- Photo saving uses Web Share with a file when supported, otherwise file download. Failed cross-origin fetches show a long-press/open-original fallback. This is an album, not an offline archive; hosting must remain available.

## Verification

`node scripts/test-keepsake.cjs` mocks DB and validates token shape, admin-only creation, missing link, private response headers, restricted fields, grouping, exclusion of all previews and pagination. No production records or external services were used.

Local Playwright browser QA uses the supplied wedding strip as a deterministic image fixture and synthetic image URLs; repeated fixture visuals are not evidence of production duplicate records. Real APIs and external requests are intercepted. Mobile 390x844 and desktop 1280x900 verified gallery entry, lightbox, Escape, reshuffle, pagination, empty state, missing-link retry, and long-title overflow; screenshots in the task workspace outputs directory. No browser exceptions. Native iOS share-sheet saving is not verified on hardware.

Post-render revision: the first mobile render placed the opening action below the tall paper arrangement. Moved the single opening action below the couple's names/date, so it appears in the first viewport. Re-rendered both sizes and verified interaction again. Adjusted section body text to 16px.

Local lacks production Mongo configuration: live album creation, real event content and production deployment must be verified in the configured environment. Existing guest photo URLs remain subject to the host's storage lifecycle.
