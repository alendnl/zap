import { redirect } from "next/navigation";

export default function ContestsIndexPage() {
  redirect("/?tab=contest");
}
