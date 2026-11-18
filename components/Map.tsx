"use client"

import React, { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import marketIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: marketIcon.src,
  iconRetinaUrl: markerIcon2x.src,
  shadowUrl: markerShadow.src,
});

interface MapProps {
  center?: number[];
  zoom?: number;
  /** Position du repère. Par défaut, le centre de la carte. */
  marker?: number[] | null;
  /** Rend la carte interactive : un clic ou un glisser place le repère. */
  onPick?: (latlng: [number, number]) => void;
  /**
   * Affiche une zone de ce rayon (en mètres) autour du centre, sans repère :
   * emplacement approximatif d'un séjour avant la réservation.
   */
  areaRadius?: number;
}

// MapContainer ne lit `center` qu'au montage : on recentre à la main quand il change.
// Dépend des nombres, pas du tableau : un nouveau rendu ne doit pas annuler le zoom de l'utilisateur.
const Recenter = ({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [map, lat, lng, zoom]);
  return null;
};

const PickOnClick = ({ onPick }: { onPick: (latlng: [number, number]) => void }) => {
  useMapEvents({
    click: (event) => onPick([event.latlng.lat, event.latlng.lng]),
  });
  return null;
};

const Map: React.FC<MapProps> = ({
  center,
  zoom,
  marker,
  onPick,
  areaRadius,
}) => {
  const [centerLat, centerLng] = center && center.length >= 2 ? center : [52, -0.09];
  const mapCenter: L.LatLngExpression = [centerLat, centerLng];
  const mapZoom = zoom ?? (center ? 4 : 2);
  const markerPosition = (areaRadius ? null : marker === undefined ? center : marker) as
    | L.LatLngExpression
    | null
    | undefined;

  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      scrollWheelZoom={Boolean(onPick)}
      className={`h-full rounded-lg ${onPick ? "cursor-crosshair" : ""}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onPick ? (
        <>
          <Recenter lat={centerLat} lng={centerLng} zoom={mapZoom} />
          <PickOnClick onPick={onPick} />
        </>
      ) : null}
      {areaRadius ? (
        <Circle
          center={mapCenter}
          radius={areaRadius}
          pathOptions={{ color: "#E11D48", fillColor: "#E11D48", fillOpacity: 0.15, weight: 2 }}
        />
      ) : null}
      {markerPosition ? (
        <Marker
          position={markerPosition}
          draggable={Boolean(onPick)}
          eventHandlers={
            onPick
              ? {
                  dragend: (event) => {
                    const { lat, lng } = (event.target as L.Marker).getLatLng();
                    onPick([lat, lng]);
                  },
                }
              : undefined
          }
        />
      ) : null}
    </MapContainer>
  );
};

export default Map;
