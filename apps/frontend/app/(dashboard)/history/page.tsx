import { redirect } from "next/navigation";

export default function HistoryRedirect() {
  redirect("/results?tab=history");
}
