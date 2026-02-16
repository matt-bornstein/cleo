import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">
          Sign in to continue
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Google OAuth + Convex Auth wiring is scaffolded in this phase. Provider
          credentials are required to complete real sign-in.
        </p>
        <div className="mt-6 space-y-2">
          <Button className="w-full">Continue with Google (scaffold)</Button>
          <Link href="/editor" className="block">
            <Button variant="secondary" className="w-full">
              Continue to local dev shell
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
