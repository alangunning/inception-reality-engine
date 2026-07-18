import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inception — Reality Engine",
  description: "Nested counterfactual realities for software-development agents"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
