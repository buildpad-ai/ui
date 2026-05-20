import { Layout, Navbar } from "nextra-theme-docs";
import Script from 'next/script';
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
    icon: "/docs/favicon.svg",
  },
};

const baseUrl =
    process.env.NODE_ENV === "production"
        ? "https://main.d39rgal2lwiqqo.amplifyapp.com"
        : "http://localhost:3000";

const widgetApiKey = "30a073d4dc67d8b35b26277d31705fb32928cb1b635191fdda5597e804d9ba15";

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
        <Script src={`${baseUrl}/api/widget/v1/widget.js`} data-api-key={widgetApiKey} strategy="beforeInteractive"></Script>
        
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
                    src="/docs/buildpad-icon.png"
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
