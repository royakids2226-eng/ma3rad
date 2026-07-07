import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth"; // Correctly import from the root auth.ts file
import BulkUploadForm from "./form";

// This is the main page, which is a Server Component.
// Its only job is to get the user's session data securely.
export default async function BulkUploadPage() {
  // Use the official `getServerSession` from next-auth with your authOptions.
  const session = await getServerSession(authOptions);

  // According to your auth.ts file, the user ID is stored in the `image` field of the session user object.
  // This is a workaround in your existing code, and we will follow it.
  // @ts-ignore
  const userId = session?.user?.image;

  // If no user ID is found, the user is not logged in, so we redirect to login.
  if (!userId) {
    redirect("/login");
  }

  // Now, render the client-side form and pass the REAL userId to it.
  return <BulkUploadForm userId={userId} />;
}
