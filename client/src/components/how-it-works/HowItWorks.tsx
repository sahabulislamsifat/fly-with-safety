import { Icon, type IconName } from '@/components/ui/Icons';
import { Card, CardContent } from '@/components/ui';

interface Step {
  step: string;
  title: string;
  description: string;
  icon: IconName;
  highlight: string;
}

const steps: Step[] = [
  {
    step: '01',
    title: 'Search your trip',
    description: 'Explore verified flight options, vetted accommodations, and curated holiday packages tailored to Bangladeshi and international routes.',
    icon: 'search',
    highlight: 'Flights, Hotels & Packages',
  },
  {
    step: '02',
    title: 'Choose what fits you',
    description: 'Compare transparent fares, baggage allowances, cancellation terms, and flight timings with zero hidden surprises.',
    icon: 'swapHorizontal',
    highlight: 'Compare available options',
  },
  {
    step: '03',
    title: 'Let FlyWithsafety handle details',
    description: 'Our dedicated travel agency team confirms seats, manages ticket issuance, and provides end-to-end visa application guidance.',
    icon: 'fileText',
    highlight: 'Booking assistance + visa support',
  },
  {
    step: '04',
    title: 'Travel with confidence',
    description: 'Enjoy 24/7 human customer support, live flight assistance, and direct WhatsApp contact throughout your entire journey.',
    icon: 'shield',
    highlight: 'Human support at every step',
  },
];

export function HowItWorks() {
  return (
    <section className="section bg-slate-900 py-16 sm:py-24 text-white" aria-labelledby="how-it-works-heading">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xs bg-amber-500/10 border border-amber-400/20 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">
            <Icon name="checkCircle" size={14} />
            <span>The FlyWithsafety Way</span>
          </div>
          <h2
            id="how-it-works-heading"
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4"
          >
            How FlyWithsafety Works
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            We combine high-speed travel comparison with the care of an agency-assisted booking desk so you never travel alone.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((item) => (
            <Card
              key={item.step}
              variant="default"
              padding="lg"
              className="bg-slate-800/80 border border-slate-700/60 rounded-xs hover:border-amber-400/40 transition-all duration-200 flex flex-col justify-between"
            >
              <CardContent className="p-0">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-2xl sm:text-3xl font-mono font-black text-amber-400/80">
                    {item.step}
                  </span>
                  <div className="w-10 h-10 rounded-xs bg-brand-red/20 border border-brand-red/30 flex items-center justify-center text-amber-400">
                    <Icon name={item.icon} size={20} />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <span className="inline-block text-xs font-semibold text-amber-300/90 mb-3">
                  {item.highlight}
                </span>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
