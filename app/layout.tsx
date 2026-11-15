import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeoSignal",
  description: "NASA-data-powered climate analysis app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}