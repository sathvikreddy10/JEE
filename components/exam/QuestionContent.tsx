"use client";

import { MathRenderer } from "./MathRenderer";

interface QuestionImage {
  url: string;
  caption?: string;
}

interface QuestionContentProps {
  text: string;
  images?: QuestionImage[] | null;
  imageUrl?: string | null;
}

export function QuestionContent({ text, images, imageUrl }: QuestionContentProps) {
  const allImages: QuestionImage[] = [];

  if (imageUrl) {
    allImages.push({ url: imageUrl });
  }
  if (images) {
    allImages.push(...images);
  }

  return (
    <div className="flex flex-col gap-6">
      <MathRenderer text={text} />

      {allImages.map((img, i) => (
        <div key={i} className="flex flex-col gap-2">
          <img
            src={img.url}
            alt={img.caption || `Diagram ${i + 1}`}
            className="rounded-lg border"
            style={{ borderColor: "rgba(72,190,255,0.2)", maxHeight: 400, objectFit: "contain" }}
          />
          {img.caption && (
            <span className="text-xs text-center font-mono" style={{ color: "var(--text-secondary)" }}>
              {img.caption}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
