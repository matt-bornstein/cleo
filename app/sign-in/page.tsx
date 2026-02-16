"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect to home when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("flow", isSignUp ? "signUp" : "signIn");

    try {
      await signIn("password", formData);
      // signIn succeeded — the ConvexAuthProvider will update isAuthenticated
      // which triggers the useEffect redirect above
    } catch (err) {
      console.error("signIn error:", err);
      setError(
        err instanceof Error
          ? err.message
          : isSignUp
            ? "Failed to create account. Email may already be registered."
            : "Invalid email or password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[380px] px-4">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">AI Editor</h1>
          <p className="text-sm text-muted-foreground">
            {isSignUp
              ? "Create an account to start collaborating"
              : "Sign in to start collaborating"}
          </p>
        </div>

        {/* Google OAuth */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => void signIn("google")}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with email
            </span>
          </div>
        </div>

        {/* Email/Password form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {isSignUp && (
            <Input
              name="name"
              placeholder="Name"
              autoComplete="name"
            />
          )}
          <Input
            name="email"
            type="email"
            placeholder="Email"
            required
            autoComplete="email"
          />
          <Input
            name="password"
            type="password"
            placeholder="Password"
            required
            minLength={6}
            autoComplete={isSignUp ? "new-password" : "current-password"}
          />
          <input type="hidden" name="flow" value={isSignUp ? "signUp" : "signIn"} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Please wait..."
              : isSignUp
                ? "Create Account"
                : "Sign In"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            className="underline hover:text-foreground"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
