import { redirect } from "next/navigation";

// Stories are accessed through the feed's StoryBar component
// This route redirects to the feed
export default function StoriesPage() {
  redirect("/feed");
}
