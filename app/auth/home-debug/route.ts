import { NextResponse } from "next/server";

import { getListings } from "@/services/listing";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getListings();

  return NextResponse.json({
    count: result.listings.length,
    nextCursor: result.nextCursor,
    listings: result.listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      imageSrc: listing.imageSrc,
      region: listing.region,
      country: listing.country,
      price: listing.price,
      category: listing.category,
    })),
  });
}
