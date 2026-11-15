import { redirect } from "next/navigation";

export default function AdminDashboardUsersRedirect() {
  redirect("/admin/users");
}
