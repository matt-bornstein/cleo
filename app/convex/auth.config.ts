const domain = resolveConvexAuthDomain();

export default {
  providers: [
    {
      domain,
      applicationID: "convex",
    },
  ],
};

function resolveConvexAuthDomain() {
  const explicitDomain = firstNonEmptyString(
    process.env.CONVEX_SITE_URL,
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  );
  if (explicitDomain) {
    return explicitDomain;
  }

  const cloudUrl = firstNonEmptyString(process.env.NEXT_PUBLIC_CONVEX_URL);
  if (cloudUrl) {
    return cloudUrl.replace(".convex.cloud", ".convex.site");
  }

  return "https://invalid.convex.site";
}

function firstNonEmptyString(...values: Array<string | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}
