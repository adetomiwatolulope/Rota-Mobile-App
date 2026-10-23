import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";
import { SITE_NAME, absoluteUrl } from "@/lib/seo";
import { colorRoles } from "@/theme/tokens.generated";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
      logo: absoluteUrl("/icon-512.png"),
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "iOS, Android",
      url: absoluteUrl("/"),
    },
  ],
};

// Web-only document shell. Expo Router injects per-route <Head> output here.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        {/* Design-system fonts. The token type styles name 'Lora' and 'DM Sans'
            exactly, so load those families at the weights they use. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Lora:wght@600&display=swap"
        />
        <meta name="color-scheme" content="light" />
        {/* theme-color meta tags cannot read CSS variables, so they read the
            token value directly. The app is light-only (DS-9: the tokens define
            no dark palette). */}
        <meta name="theme-color" content={colorRoles.primary} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {/* The background is painted here so it is white before the app
            hydrates. Forced-colors (Windows High Contrast) keeps a visible
            focus outline using the system CanvasText colour. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root { color-scheme: light; }
              html, body { background-color: var(--color-surface); }
              #site-header [role="link"]:focus-visible,
              #site-header [role="button"]:focus-visible,
              #site-drawer [role="link"]:focus-visible,
              #site-drawer [role="button"]:focus-visible {
                outline: 2px solid var(--color-secondary);
                outline-offset: 3px;
              }
              @media (forced-colors: active) {
                #site-header [role="link"]:focus-visible,
                #site-header [role="button"]:focus-visible,
                #site-drawer [role="link"]:focus-visible,
                #site-drawer [role="button"]:focus-visible {
                  outline: 2px solid CanvasText;
                }
              }
              /* Mobile: the header collapses to a hamburger that opens a
                 full-screen drawer. Visibility is CSS-driven so the mobile
                 layout is correct on first paint, before the app hydrates. */
              #site-menu-button { display: none !important; }
              /* Pin the drawer to the viewport so it is always full screen,
                 regardless of how the app tree is positioned. */
              #site-drawer { position: fixed !important; }
              @media (max-width: 767px) {
                #site-nav { display: none !important; }
                #site-cta { display: none !important; }
                #site-menu-button { display: flex !important; }
              }
              @media (min-width: 768px) {
                #site-drawer { display: none !important; }
              }
            `,
          }}
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
