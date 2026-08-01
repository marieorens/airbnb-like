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
