import { Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style-prefixed.css";

export const metadata = {
  title: {
    template: "%s – Buildpad UI",
    default: "Buildpad UI Docs",
  },
  description:
    "Schema-aware components and code distribution platform for Next.js.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pageMap = await getPageMap();
  return (
    <html lang="en" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={
            <Navbar
              logo={
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontWeight: 700,
                    fontSize: "1rem",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/buildpad-icon.png"
                    alt="Buildpad"
                    width={24}
                    height={24}
                  />
                  Buildpad UI
                </span>
              }
            />
          }
          pageMap={pageMap}
          docsRepositoryBase="https://github.com/microbuild-ui/ui/tree/main/apps/docs"
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
