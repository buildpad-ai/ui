/**
 * Root layout — app/[lang]/layout.tsx
 *
 * The only server component in a Buildpad app (every scaffolded page is
 * "use client"), so all locale plumbing lives here: `generateStaticParams`,
 * `notFound()` for unknown locales, `<html lang dir>`, Mantine's
 * `DirectionProvider`, and `<I18nProvider>` (static locale + dictionary only —
 * safe in the root layout; auth-bearing providers stay in
 * app/[lang]/(authenticated)/layout.tsx, see Bug 22).
 *
 * @buildpad/origin: app/lang-layout
 * @buildpad/version: 2.0.0
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ColorSchemeScript,
  DirectionProvider,
  MantineProvider,
  mantineHtmlProps
} from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { Inter } from "next/font/google";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "../design-tokens.css";
import "../globals.css";
import { theme } from "@/lib/theme";
import { hasLocale, locales, localeMeta } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { I18nProvider } from "@/lib/i18n/provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"]
});

type Params = Promise<{ lang: string }>;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dictionary = await getDictionary(lang);
  return { title: dictionary.app.brand, description: dictionary.app.description };
}

export default async function RootLayout({
  children,
  params
}: Readonly<{ children: React.ReactNode; params: Params }>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const dictionary = await getDictionary(lang);
  const direction = localeMeta[lang].direction;

  return (
    <html lang={lang} dir={direction} {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
        <link rel="shortcut icon" href="/favicon.ico" />
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
        />
      </head>
      <body className={inter.variable}>
        <DirectionProvider initialDirection={direction} detectDirection={false}>
          <MantineProvider theme={theme} defaultColorScheme="auto">
            <ModalsProvider>
              <Notifications position="top-right" />
              <I18nProvider locale={lang} dictionary={dictionary}>
                {children}
              </I18nProvider>
            </ModalsProvider>
          </MantineProvider>
        </DirectionProvider>
      </body>
    </html>
  );
}
