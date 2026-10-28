// The example trip used by the seed script and by the "Use the example" buttons in the app.

export const DEMO_TRIP = {
  name: "Marrakech May 2027",
  destination: "Marrakech, Morocco",
  startDate: "2027-05-14",
  endDate: "2027-05-18",
  currency: "EUR",
  organizerName: "Miguel Gomes",
  organizerEmail: "miguel@example.com",
  autopayLimit: "1500",
};

// One traveller per line: name, email, notes for the agent.
export const DEMO_TRAVELLERS = `Miguel Gomes, miguel@example.com
Ana Ribeiro, ana@example.com, Skips the desert tour
Rui Costa, rui@example.com, Wants the single room
Joana Pires, joana@example.com
Tiago Matos, tiago@example.com, Skips the desert tour
Inês Lopes, ines@example.com
Pedro Alves, pedro@example.com
Sofia Nunes, sofia@example.com, Skips the desert tour
Diogo Faria, diogo@example.com
Marta Silva, marta@example.com
Hugo Santos, hugo@example.com
Rita Moreira, rita@example.com`;

export const DEMO_CONFIRMATIONS = `From: reservations@riad-dar-zitoun.example
Subject: Booking confirmed — Riad Dar Zitoun, 14–18 May 2027

Dear Miguel,
Thank you for booking the whole riad (4 double rooms, 1 triple room and 1 single room, 12 guests) for 4 nights, 14 May to 18 May 2027.
Total: 2,880.00 EUR (breakfast included). The single room is +90 EUR, included in the total.
Payment schedule: 30% deposit due by 1 March 2027, remaining balance due 15 April 2027.
Payments via PayPal to payments@riad-dar-zitoun.example.
Cancellation: free until 1 March; after that the deposit is non-refundable.

---
Atlas Desert Tours — booking #ADT-5521
Merzouga 2-day desert tour, 16–17 May 2027, 9 participants x 145 EUR = 1,305 EUR.
Full payment due 1 May 2027. Pay by PayPal: bookings@atlas-desert.example

---
Marrakech Transfers — airport pick-up and drop-off for 12 people, minibus, 14 and 18 May 2027.
Price: 240 EUR, payable in full by 30 April 2027 via PayPal to hello@mk-transfers.example`;
