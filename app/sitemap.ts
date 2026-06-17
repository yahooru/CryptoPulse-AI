import type { MetadataRoute } from "next"

import { getSiteUrl } from "@/lib/site"

const routes = ["/", "/dashboard", "/analysis", "/risk", "/recommendations", "/backtesting", "/reasoning"]

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl()
  const now = new Date()
  return routes.map((route) => ({
    url: new URL(route, siteUrl).toString(),
    lastModified: now,
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.8,
  }))
}
