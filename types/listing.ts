export interface CurrentUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
}

export interface ReservationSummary {
  id: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  imageSrc: string;
  createdAt: Date;
  category: string;
  roomCount: number;
  bathroomCount: number;
  guestCount: number;
  userId: string;
  price: number;
  country: string | null;
  latlng: number[];
  region: string | null;
  user?: {
    name: string | null;
    image: string | null;
  };
  reservations?: {
    startDate: Date;
    endDate: Date;
  }[];
  reservation?: ReservationSummary;
}

export type ListingLike = Listing & {
  image_src?: string | null;
  imageSrc?: string;
  price_per_night?: number | null;
  room_count?: number | null;
  bathroom_count?: number | null;
  guest_count?: number | null;
  host_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  listing_photos?: {
    public_url?: string | null;
    storage_path?: string | null;
    position?: number | null;
  }[];
};
