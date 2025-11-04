import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ADO Explorer - Next-Gen Azure DevOps Browser",
  description: "A powerful command-line interface to search and explore Azure DevOps boards",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
