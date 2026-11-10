import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], axes: ["wdth"] });
const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"] });

const description =
  "An AI agent that runs the money side of a group trip: it collects from every traveller with PayPal invoices and pays each supplier when the pot covers it.";

export const metadata: Metadata = {
  // Absolute URLs for the Open Graph and Twitter images.
  metadataBase: new URL(process.env.RENDER_EXTERNAL_URL ?? "https://trippot.onrender.com"),
  title: "TripPot",
  description,
  openGraph: { title: "TripPot", description, siteName: "TripPot", type: "website" },
  twitter: { card: "summary_large_image", title: "TripPot", description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${instrument.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
