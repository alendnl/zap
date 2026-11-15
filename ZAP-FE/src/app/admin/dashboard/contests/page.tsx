import { redirect } from "next/navigation";

export default function AdminDashboardContestsRedirect() {
  redirect("/admin/contests/analytics");
}
