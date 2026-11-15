'use client';

import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { PublicBranchDTO } from '@/lib/types';
import { ExternalLink, MapPin, Navigation, Phone } from 'lucide-react';

interface StoreBranchesMapProps {
  storeName: string;
  branches: PublicBranchDTO[];
  googleMapLink: string;
}

export default function StoreBranchesMap({
  storeName,
  branches,
  googleMapLink,
}: StoreBranchesMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const container = mapContainerRef.current;
    if (!container || branches.length === 0) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const first = branches[0];
      const map = L.map(mapContainerRef.current, {
        center: [first.lat, first.lng],
        zoom: branches.length > 1 ? 11 : 14,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const pinIcon = L.divIcon({
        className: 'aada-map-pin',
        html: `<div style="width:32px;height:32px;border-radius:9999px;background:linear-gradient(135deg,#0B1F3A,#007BFF);border:3px solid #FBBF24;box-shadow:0 6px 18px rgba(11,31,58,0.35);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:12px;">A</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      const bounds = L.latLngBounds([]);
      branches.forEach((branch) => {
        const marker = L.marker([branch.lat, branch.lng], { icon: pinIcon }).addTo(map);
        marker.bindPopup(
          `<div dir="rtl" style="font-family:Cairo,sans-serif;min-width:160px;text-align:right">
            <strong style="color:#0B1F3A;font-size:13px">${storeName} - ${branch.name}</strong><br/>
            <span style="color:#475569;font-size:11px">${branch.city} · ${branch.area}</span><br/>
            <span style="color:#64748b;font-size:11px">${branch.address}</span>
          </div>`
        );
        bounds.extend([branch.lat, branch.lng]);
      });

      if (branches.length > 1) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 });
      }

      mapInstanceRef.current = map;
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [branches, storeName]);

  const focusBranch = (idx: number) => {
    setActiveIdx(idx);
    const branch = branches[idx];
    if (branch && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([branch.lat, branch.lng], 14, { duration: 0.5 });
    }
  };

  if (branches.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
          <MapPin className="w-5 h-5 text-amber-500" />
          <span>الفروع على الخريطة (OpenStreetMap)</span>
        </h2>
        <a
          href={googleMapLink}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1.5"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>فتح الاتجاهات في خرائط جوجل</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm h-72 sm:h-80 w-full relative z-10 bg-slate-100 dark:bg-slate-800">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {branches.map((branch, idx) => (
          <button
            key={`${branch.name}-${idx}`}
            type="button"
            onClick={() => focusBranch(idx)}
            className={`text-right p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
              activeIdx === idx
                ? 'bg-sky-50/90 dark:bg-sky-950/50 border-sky-400 dark:border-sky-600'
                : 'bg-white/80 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-sky-300'
            }`}
          >
            <div className="space-y-1 min-w-0">
              <p className="font-black text-sm text-[#0B1F3A] dark:text-white truncate">{branch.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {branch.city} · {branch.area} — {branch.address}
              </p>
              <p className="text-xs font-mono text-sky-700 dark:text-sky-400 flex items-center gap-1.5" dir="ltr">
                <Phone className="w-3 h-3 shrink-0" />
                <span>{branch.phone}</span>
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
              {branch.crowdLevel || 'مفتوح'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
