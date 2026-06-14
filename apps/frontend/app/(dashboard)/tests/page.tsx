"use client";

import MyTestsTimeline from "@/components/dashboard/MyTestsTimeline";

export default function TestsCatalogPage() {
  return (
    <div className="section">
      <div className="section__head">
        <span className="section__index">01</span>
        <h2 className="section__title">Browse <em>tests</em></h2>
        <p className="section__sub">Every test ever scheduled for you — upcoming, in progress, completed, and missed.</p>
      </div>
      <MyTestsTimeline />
    </div>
  );
}
