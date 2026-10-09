import { Icon } from '@/components/ui/Icons';

interface PartnerBadge {
  id: string;
  name: string;
  category: string;
  accent: string;
}

const partnerBadges: PartnerBadge[] = [
  { id: 'biman', name: 'Biman Bangladesh', category: 'Flag Carrier', accent: 'border-emerald-600/30 text-emerald-800 bg-emerald-50/50' },
  { id: 'emirates', name: 'Emirates Airline', category: 'Global Partner', accent: 'border-red-600/30 text-red-800 bg-red-50/50' },
  { id: 'singapore', name: 'Singapore Airlines', category: 'Star Alliance', accent: 'border-blue-700/30 text-blue-900 bg-blue-50/50' },
  { id: 'qatar', name: 'Qatar Airways', category: 'Oneworld Member', accent: 'border-purple-700/30 text-purple-900 bg-purple-50/50' },
  { id: 'sharetrip', name: 'ShareTrip Inventory', category: 'Consolidator', accent: 'border-cyan-600/30 text-cyan-900 bg-cyan-50/50' },
  { id: 'agoda', name: 'Agoda Hospitality', category: 'Hotel Network', accent: 'border-amber-600/30 text-amber-900 bg-amber-50/50' },
];

export function Partners() {
  return (
    <section className="py-10 sm:py-14 bg-slate-50 border-y border-slate-200" aria-labelledby="partners-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6">
          <p id="partners-heading" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Supported Airline &amp; Inventory References
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {partnerBadges.map((partner) => (
            <div
              key={partner.id}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xs border shadow-2xs hover:shadow-xs transition-all duration-150 ${partner.accent}`}
            >
              <div className="w-5 h-5 rounded-xs bg-white flex items-center justify-center shadow-2xs">
                <Icon name="plane" size={12} className="text-slate-700" />
              </div>
              <div className="text-left">
                <p className="text-xs sm:text-sm font-bold leading-tight">{partner.name}</p>
                <p className="text-[10px] text-slate-500 font-medium">{partner.category}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-slate-400 text-center mt-6">
          Inventory is aggregated across verified airline distribution networks and licensed booking desks. Reference purposes only.
        </p>
      </div>
    </section>
  );
}