import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/services/user";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({
      hasUser: false,
      message: "Not authenticated",
    });
  }

  const admin = createAdminClient();

  const [
    listingsResult,
    guestBookingsResult,
    hostBookingsResult,
    paymentsResult,
  ] = await Promise.all([
    admin
      .from("listings")
      .select(
        "id,title,region,country,price_per_night,status,created_at,listing_photos(public_url,storage_path,position)"
      )
      .eq("host_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("bookings")
      .select("id,listing_id,guest_id,host_id,total_price,status,created_at")
      .eq("guest_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("bookings")
      .select("id,listing_id,guest_id,host_id,total_price,status,created_at")
      .eq("host_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("payments")
      .select("id,booking_id,user_id,amount,currency,status,stripe_checkout_session_id,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return NextResponse.json({
    hasUser: true,
    user: {
      id: user.id,
      email: user.email,
    },
    listings: {
      error: listingsResult.error?.message ?? null,
      data: listingsResult.data ?? [],
    },
    guestBookings: {
      error: guestBookingsResult.error?.message ?? null,
      data: guestBookingsResult.data ?? [],
    },
    hostBookings: {
      error: hostBookingsResult.error?.message ?? null,
      data: hostBookingsResult.data ?? [],
    },
    payments: {
      error: paymentsResult.error?.message ?? null,
      data: paymentsResult.data ?? [],
    },
  });
}
