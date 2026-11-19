import { notFound } from "next/navigation";
import { prototypes, published } from "@/lib/prototypes";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ slug: string }> };
function lookup(slug: string) {
  return prototypes.find((p) => p.slug === slug && p.public) ?? notFound();
}
export async function generateMetadata({ params }: Context): Promise<Metadata> {
  const p = lookup((await params).slug);
  const origin =
    process.env.SITE_URL ||
    (process.env.VERCEL_URL
      ? "https://" + process.env.VERCEL_URL
      : "http://localhost:3000");
  return {
    metadataBase: new URL(origin),
    title: p.title,
    description: p.description,
    openGraph: {
      type: "website",
      title: p.title,
      description: p.description,
      images: ["/share/" + p.slug + ".jpg"],
      videos: [{ url: "/share/" + p.slug + ".mp4", type: "video/mp4" }],
    },
  };
}
export default async function PublicPrototype({ params }: Context) {
  const p = lookup((await params).slug);
  const { default: Page } = await published[p.slug]();
  return <Page />;
}
