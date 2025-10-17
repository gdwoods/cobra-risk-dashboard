
export const metadata = { 
  title: "Cobra Risk Dashboard", 
  description: "Intraday risk guardrails for DAS/Cobra",
  icons: {
    icon: '/cobra-favicon.svg',
    shortcut: '/cobra-favicon.svg',
    apple: '/cobra-favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
