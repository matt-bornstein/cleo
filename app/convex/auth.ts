import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

const googleClientId =
  process.env.AUTH_GOOGLE_CLIENT_ID ?? "GOOGLE_CLIENT_ID_MISSING";
const googleClientSecret =
  process.env.AUTH_GOOGLE_CLIENT_SECRET ?? "GOOGLE_CLIENT_SECRET_MISSING";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  ],
});
