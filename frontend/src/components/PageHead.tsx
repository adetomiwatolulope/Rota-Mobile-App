import Head from "expo-router/head";
import {
  DEFAULT_DESCRIPTION,
  SITE_NAME,
  absoluteUrl,
  formatTitle,
} from "@/lib/seo";

type PageHeadProps = {
  page?: string;
  description?: string;
  // App surfaces (splash, auth, dashboard) sit behind redirects/auth and must
  // not be indexed. Only public pages opt into indexing.
  noIndex?: boolean;
  path?: string;
};

export function PageHead({
  page,
  description = DEFAULT_DESCRIPTION,
  noIndex = false,
  path = "/",
}: PageHeadProps) {
  const title = formatTitle(page);
  const url = absoluteUrl(path);
  const image = absoluteUrl("/og-image.png");

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta
        name="robots"
        content={noIndex ? "noindex, nofollow" : "index, follow"}
      />
      <link rel="canonical" href={url} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Head>
  );
}
