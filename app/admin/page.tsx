import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata:Metadata={
  title:"Admin — Hisgrace Texture",
  description:"Manage the Hisgrace Texture storefront.",
};

export default function AdminPage(){
  return <AdminDashboard/>;
}
