import type { Metadata, Viewport } from "next";
import "./globals.css";
import PinGate from "./PinGate";

export const metadata: Metadata = {
  title: "GM Dashboard",
  description: "Tablet-first GM task and calendar dashboard",
  applicationName: "GM Dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b1016",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><PinGate>{children}</PinGate></body>
    </html>
  );
}
