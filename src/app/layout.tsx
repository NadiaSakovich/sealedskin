import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SealedSkin — Build your skincare routine",
  description:
    "A guided quiz that analyzes your skin and builds a personalized AM/PM skincare routine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved (or system) theme before first paint to avoid a flash.
            Runs synchronously during HTML parsing. Keep in sync with ThemeToggle. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("ss-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
