export interface CurrentUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  role: "guest" | "host" | "admin";
  isHost: boolean;
  phone: string | null;
  whatsapp: string | null;
  countryOfResidence: string | null;
  cityOfResidence: string | null;
  countryOfOrigin: string | null;
  accountPurpose: string[];
  preferredContact: "email" | "phone" | "whatsapp";
  bio: string | null;
  profileCompletedAt: string | null;
  isProfileComplete: boolean;
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
  photos: {
    publicUrl: string;
    position: number;
  }[];
  createdAt: Date;
  category: string;
  roomCount: number;
  bathroomCount: number;
  guestCount: number;
  userId: string;
  price: number;
  assetType: string;
  transactionType: string;
  currency: string;
  salePrice: number | null;
  monthlyRent: number | null;
  areaSqm: number | null;
  landTitleStatus: string | null;
  propertyCondition: string | null;
  availableFrom: string | null;
  addressDetails: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  contactEmail: string | null;
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
  asset_type?: string | null;
  transaction_type?: string | null;
  currency?: string | null;
  sale_price?: number | null;
  monthly_rent?: number | null;
  area_sqm?: number | null;
  land_title_status?: string | null;
  property_condition?: string | null;
  available_from?: string | null;
  address_details?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
  contact_email?: string | null;
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
