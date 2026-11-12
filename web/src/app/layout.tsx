import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gagesite",
  description: "Your shop's website, built with you step by step.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Browser extensions (e.g. grammar checkers) add attributes to <html>/<body> before React loads;
    // suppressHydrationWarning keeps that from showing up as a hydration error. It only applies one level deep.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Cabinet Grotesk (display face) is distributed by Fontshare, not Google Fonts. */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@500,700,800&display=swap"
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
