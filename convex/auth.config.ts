const siteUrl = process.env.CONVEX_SITE_URL;
if (!siteUrl) {
  throw new Error(
    "CONVEX_SITE_URL is not set. Run: npx convex env set CONVEX_SITE_URL https://<deployment>.convex.site"
  );
}

export default {
  providers: [
    {
      domain: siteUrl,
      applicationID: "convex",
    },
  ],
};
