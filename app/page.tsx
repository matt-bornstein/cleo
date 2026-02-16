"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Toolbar } from "@/components/layout/Toolbar";
import { DocumentList } from "@/components/layout/DocumentList";
import { Loader2 } from "lucide-react";

function RedirectToSignIn() {
  const router = useRouter();
  useEffect(() => {
    router.push("/sign-in");
  }, [router]);
  return null;
}

export default function Home() {
  return (
    <>
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <RedirectToSignIn />
      </Unauthenticated>
      <Authenticated>
        <div className="flex min-h-screen flex-col">
          <Toolbar />
          <main className="flex-1 p-6">
            <DocumentList />
          </main>
        </div>
      </Authenticated>
    </>
  );
}
