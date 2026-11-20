import { redirect } from "next/navigation";

// The homepage has been removed; the Overall Rankings page is now the landing page.
export default function HomePage() {
  redirect("/ranking");
}