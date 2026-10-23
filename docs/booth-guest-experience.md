# Wedding booth guest experience

Happy case: a guest sees real finished samples, enters the camera, positions their group, starts the timed sequence, sees captured shots accumulate, checks/enlarges the finished print, chooses quantity, submits the existing print/payment flow, scans the download QR, and returns to welcome for the next guest.

Emotional target: quiet confidence, with a clear shutter payoff.

Directions considered (product fit / clarity / distinctiveness / feasibility / accessibility / reuse, each out of 5):
- Wedding paper + clear kiosk controls: 5/5/4/5/5/5. Existing local Nanum Myeongjo display, system Korean sans for controls; sage accent and warm paper; photo-led layout; restrained borders and 14px action corners. Existing shutter flash/still is the hero transition. Selected to preserve the event identity and reduce launch risk.
- Dark camera studio: 4/5/4/3/4/4. Dark neutral canvas, bright shutter accent, sans typography, full-screen viewfinder. Strong camera focus but changes the established wedding presentation.
- Playful sticker booth: 3/4/5/2/4/3. Bold lettering, saturated accents, sticker imagery and bouncy transitions. Less appropriate to this event and unnecessary new assets.

Use only actual configured sample/guest photos and captured images. All displayed counts, intervals, quantities, prices and remaining time derive from the existing event/layout/session state. No extra frame-selection screen: the event already selects one layout. Sending means request in progress; done means request accepted, not physical printing completed. No invented pickup location.

Changes: four-stage non-interactive progress indicator; shorter welcome copy and factual session summary; consistent prominent actions; captured contact sheet; full-size print dialog with native focus containment/Escape and close control; sending feedback; guest-facing processing copy; explicit next-guest completion action. Keep payment, merge, capture, print APIs and 60-second reset intact.

Validation (2026-10-23): TypeScript passed; existing welcome and random-preview tests passed. Browser QA used mocked event/layout/merge/print responses and a fake camera at 1180x820 and 390x844. Completed three-cut capture, contact-sheet updates, preview enlargement/Escape/close, failed-print retry retaining the preview, QR rendering, and next-guest reset. Two mock print requests, zero physical prints, zero page errors. Screenshots were inspected. Post-render revision moved the capture confirmation above the cut counter to remove overlap. Live DB, real iPad Safari hardware, physical printer, and paid checkout were not exercised. Temporary QA route removed before delivery.
