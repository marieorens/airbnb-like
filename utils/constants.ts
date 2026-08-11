import { TbBeach, TbMountain, TbPool } from "react-icons/tb";
import {
  GiBarn,
  GiBoatFishing,
  GiCactus,
  GiCastle,
  GiCaveEntrance,
  GiForestCamp,
  GiIsland,
  GiWindmill,
} from "react-icons/gi";
import { FaSkiing } from "react-icons/fa";
import { BsSnow } from "react-icons/bs";
import { IoDiamond } from "react-icons/io5";
import { MdOutlineVilla } from "react-icons/md";

export const categories = [
  {
    label: "Plage",
    icon: TbBeach,
    description: "Ce bien est proche de la plage.",
  },
  {
    label: "Moulins",
    icon: GiWindmill,
    description: "Ce bien se trouve dans un environnement atypique.",
  },
  {
    label: "Moderne",
    icon: MdOutlineVilla,
    description: "Ce bien a un style moderne.",
  },
  {
    label: "Campagne",
    icon: TbMountain,
    description: "Ce bien est situe en campagne.",
  },
  {
    label: "Piscines",
    icon: TbPool,
    description: "Ce bien dispose d'une piscine.",
  },
  {
    label: "Iles",
    icon: GiIsland,
    description: "Ce bien est situe sur une ile.",
  },
  {
    label: "Lac",
    icon: GiBoatFishing,
    description: "Ce bien est proche d'un lac.",
  },
  {
    label: "Ski",
    icon: FaSkiing,
    description: "Ce bien est adapte aux sejours au ski.",
  },
  {
    label: "Chateaux",
    icon: GiCastle,
    description: "Ce bien a un charme historique.",
  },
  {
    label: "Grottes",
    icon: GiCaveEntrance,
    description: "Ce bien propose une experience troglodyte.",
  },
  {
    label: "Camping",
    icon: GiForestCamp,
    description: "Ce bien propose une experience camping.",
  },
  {
    label: "Neige",
    icon: BsSnow,
    description: "Ce bien est adapte aux sejours enneiges.",
  },
  {
    label: "Desert",
    icon: GiCactus,
    description: "Ce bien est situe dans un environnement desertique.",
  },
  {
    label: "Granges",
    icon: GiBarn,
    description: "Ce bien a un style grange ou rural.",
  },
  {
    label: "Lux",
    icon: IoDiamond,
    description: "Ce bien est recent et haut de gamme.",
  },
];

export const LISTINGS_BATCH = 16;

export const assetTypes = [
  {
    value: "short_stay",
    label: "Logement court sejour",
    transactionType: "booking",
  },
  {
    value: "house_rent",
    label: "Maison / appartement a louer",
    transactionType: "rent",
  },
  {
    value: "house_sale",
    label: "Maison / appartement a vendre",
    transactionType: "sale",
  },
  {
    value: "land_sale",
    label: "Parcelle / terrain a vendre",
    transactionType: "sale",
  },
  {
    value: "commercial_rent",
    label: "Local commercial a louer",
    transactionType: "rent",
  },
  {
    value: "commercial_sale",
    label: "Local commercial a vendre",
    transactionType: "sale",
  },
  {
    value: "other",
    label: "Autre bien immobilier",
    transactionType: "lead",
  },
] as const;

export const currencies = ["USD", "EUR", "XOF"] as const;

export const menuItems = [
  {
    label: "Mes voyages",
    path: "/trips",
  },
  {
    label: "Mes favoris",
    path: "/favorites",
  },
  {
    label: "Mes reservations",
    path: "/reservations",
  },
  {
    label: "Mes biens",
    path: "/properties",
  },
];
