// Live check of booking extraction with a realistic confirmation. Costs a fraction of a cent (Haiku).
// Run: pnpm try:extract
import { extractBookings } from "../src/lib/ai/extract-bookings";

const confirmation = `
From: reservations@riad-dar-zitoun.example
Subject: Booking confirmed — Riad Dar Zitoun, 14–18 May 2027

Dear Miguel,
Thank you for booking the whole riad (6 rooms, 12 guests) for 4 nights, 14 May to 18 May 2027.
Total: 2,880.00 EUR (breakfast included). Room 6 is a single: +90 EUR supplement included in the total.
Payment schedule: 30% deposit due by 1 March 2027, remaining balance due 15 April 2027.
Payments via PayPal to payments@riad-dar-zitoun.example.
Cancellation: free until 1 March; after that the deposit is non-refundable.

---
Atlas Desert Tours — booking #ADT-5521
Merzouga 2-day desert tour, 16–17 May 2027, 9 participants x 145 EUR = 1,305 EUR.
Full payment due 1 May 2027.
`;

const t0 = Date.now();
const bookings = await extractBookings(confirmation, "Lisbon → Marrakech, 12 friends, 14–18 May 2027, EUR");
console.log(JSON.stringify(bookings, null, 2));
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
