export default {
  providers: [
    {
      domain: process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "http://127.0.0.1:3213",
      applicationID: "convex",
    },
  ],
};
