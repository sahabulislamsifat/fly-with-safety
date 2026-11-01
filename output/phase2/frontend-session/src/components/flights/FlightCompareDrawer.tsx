'use client';

import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  removeOfferFromCompare,
  clearCompare,
  setCompareDrawerOpen,
} from '@/redux/slices/compareSlice';
import { openBookingModal } from '@/redux/slices/bookingSlice';
import { Button } from '@/components/ui';
import { Icon } from '@/components/ui/Icons';
import { formatFlightTime } from '@/lib/api/flights';

export function FlightCompareDrawer() {
  const dispatch = useAppDispatch();
  const { offers, isDrawerOpen } = useAppSelector((state) => state.compare);

  if (offers.length === 0) return null;

  return (
    <div
      aria-label="Flight comparison panel"
      className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-neutral-300 shadow-2xl transition-all duration-300"
    >
      {/* Toggle header bar */}
      <div className="bg-neutral-900 text-white px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm">
            Comparing {offers.length} {offers.length === 1 ? 'Flight' : 'Flights'} (Max 4)
          </span>
          <span className="text-xs text-neutral-400">
            Side-by-side fare and schedule comparison
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => dispatch(clearCompare())}
            className="text-xs text-neutral-300 hover:text-white underline cursor-pointer"
          >
            Clear All
          </button>
          <button
            type="button"
            onClick={() => dispatch(setCompareDrawerOpen(!isDrawerOpen))}
            className="p-1 text-neutral-300 hover:text-white rounded-xs cursor-pointer"
            aria-label={isDrawerOpen ? 'Collapse comparison' : 'Expand comparison'}
          >
            <Icon name={isDrawerOpen ? 'chevronDown' : 'chevronUp'} size={20} />
          </button>
        </div>
      </div>

      {/* Expanded Comparison Matrix */}
      {isDrawerOpen && (
        <div className="p-6 max-h-[70vh] overflow-x-auto overflow-y-auto">
          <div className="min-w-[700px] grid grid-cols-5 gap-4 text-sm divide-x divide-neutral-200">
            {/* Row Labels */}
            <div className="space-y-4 font-semibold text-text-secondary text-xs uppercase tracking-wider pr-3">
              <div className="h-10 flex items-center">Airline & Flight</div>
              <div className="h-8 flex items-center">Price</div>
              <div className="h-8 flex items-center">Stops</div>
              <div className="h-8 flex items-center">Duration</div>
              <div className="h-8 flex items-center">Schedule</div>
              <div className="h-8 flex items-center">Baggage</div>
              <div className="h-8 flex items-center">Flexibility</div>
              <div className="h-10 flex items-center">Action</div>
            </div>

            {/* Offer Columns */}
            {offers.map((offer) => {
              const totalPrice = offer.price?.totalAmount ?? 0;
              const currency = offer.price?.currency || 'BDT';
              const outbound = offer.outboundLeg;
              const baggage = offer.baggageAllowance
                ? `${offer.baggageAllowance.cabinKg}kg cabin / ${offer.baggageAllowance.checkedKg}kg checked`
                : '1 x 20kg';
              const durationHours = Math.floor((offer.totalDurationMinutes || 180) / 60);
              const durationMins = (offer.totalDurationMinutes || 180) % 60;

              return (
                <div key={offer.id} className="space-y-4 pl-4 relative">
                  <button
                    type="button"
                    onClick={() => dispatch(removeOfferFromCompare(offer.id))}
                    className="absolute top-0 right-0 text-neutral-400 hover:text-red-500 cursor-pointer"
                    title="Remove from compare"
                  >
                    <Icon name="x" size={16} />
                  </button>

                  <div className="h-10">
                    <p className="font-bold text-text-primary truncate">
                      {offer.airline?.name || 'Airline'}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {offer.flightNumber} · {offer.aircraft || 'Commercial Jet'}
                    </p>
                  </div>

                  <div className="h-8 flex items-center">
                    <span className="font-extrabold text-base text-brand-primary">
                      {totalPrice.toLocaleString()} {currency}
                    </span>
                  </div>

                  <div className="h-8 flex items-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-xs font-medium ${
                        offer.stopsCount === 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {offer.stopsCount === 0
                        ? 'Non-stop'
                        : `${offer.stopsCount} Stop(s)`}
                    </span>
                  </div>

                  <div className="h-8 flex items-center text-xs text-text-secondary">
                    {durationHours}h {durationMins}m
                  </div>

                  <div className="h-8 flex items-center text-xs">
                    {formatFlightTime(outbound?.departureTime)} → {formatFlightTime(outbound?.arrivalTime)}
                  </div>

                  <div className="h-8 flex items-center text-xs text-text-secondary">
                    {baggage}
                  </div>

                  <div className="h-8 flex items-center text-xs">
                    {offer.refundable ? (
                      <span className="text-emerald-700 font-medium">Refundable</span>
                    ) : (
                      <span className="text-text-tertiary">Non-refundable</span>
                    )}
                  </div>

                  <div className="h-10 flex items-center">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() =>
                        dispatch(
                          openBookingModal({
                            type: 'FLIGHT',
                            title: `${offer.airline?.name || 'Flight'} (${outbound?.origin?.code || 'DEP'} → ${outbound?.destination?.code || 'ARR'})`,
                            totalPrice,
                            currency,
                            details: { offerId: offer.id, flightNumber: offer.flightNumber },
                          })
                        )
                      }
                    >
                      Book Flight
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
