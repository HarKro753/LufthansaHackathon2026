"use client";

import type { TripStay } from "@/types/trip";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPrice(price: number | null, currency: string): string {
  if (price === null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function StarRating({ stars }: { stars: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`w-3 h-3 ${i < stars ? "text-yellow-400" : "text-gray-200"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function StayCard({ stay }: { stay: TripStay }) {
  const checkIn = formatDate(stay.check_in_date);
  const checkOut = formatDate(stay.check_out_date);

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Hero image */}
      {stay.image_url && (
        <div className="w-full h-36 relative">
          <img
            src={stay.image_url}
            alt={stay.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-3">
        <h4 className="text-sm font-semibold text-gray-900">{stay.name}</h4>

        <div className="flex items-center gap-2 mt-1.5">
          {stay.stars && stay.stars > 0 && <StarRating stars={stay.stars} />}
          {stay.booking_source && (
            <span className="text-[11px] text-gray-400">
              {stay.booking_source}
            </span>
          )}
        </div>

        {/* Rating badge + reviews */}
        {stay.rating !== null && stay.rating > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-flex items-center justify-center px-1.5 h-5 rounded bg-[#FF385C] text-[11px] font-bold text-white">
              {stay.rating.toFixed(1)}
            </span>
            {stay.reviews !== null && stay.reviews > 0 && (
              <span className="text-[11px] text-gray-400">
                {stay.reviews.toLocaleString()} reviews
              </span>
            )}
          </div>
        )}

        {stay.address && (
          <p className="text-[11px] text-gray-400 mt-1.5 truncate">
            {stay.address}
          </p>
        )}
      </div>

      {/* Footer: price + dates + booking */}
      <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-between bg-gray-50/50">
        <div>
          {stay.total_price !== null ? (
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-gray-900">
                {formatPrice(stay.total_price, stay.currency)}
              </span>
              <span className="text-[11px] text-gray-400">total</span>
            </div>
          ) : stay.price_per_night !== null ? (
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-gray-900">
                {formatPrice(stay.price_per_night, stay.currency)}
              </span>
              <span className="text-[11px] text-gray-400">/night</span>
            </div>
          ) : null}
          <div className="text-[11px] text-gray-400 mt-0.5">
            {checkIn} - {checkOut} &middot; {stay.nights}{" "}
            {stay.nights === 1 ? "night" : "nights"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stay.google_maps_url && (
            <a
              href={stay.google_maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              title="View on Google Maps"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </a>
          )}
          {stay.booking_link && (
            <a
              href={stay.booking_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[#FF385C] hover:text-[#cc1c40] transition-colors px-3 py-1.5 rounded-lg border border-[#FFB3C1] hover:bg-[#FFF0F3]"
            >
              Book
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
