import { redirect } from "next/navigation";

export default function HomePage() {
  safeRedirect("/editor");
}

function safeRedirect(path: string) {
  if (typeof redirect === "function") {
    redirect(path);
  }
}
