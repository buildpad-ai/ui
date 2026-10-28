import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Buildpad UI — Copy & Own components for data-heavy apps',
  description:
    'Schema-aware Mantine components, Storybooks on live DaaS data, and the CLI + MCP tooling to add them to any Next.js app.',
  icons: { icon: '/buildpad-mark.svg' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
