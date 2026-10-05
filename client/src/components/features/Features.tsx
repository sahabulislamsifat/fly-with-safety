import { features } from '@/lib/data/site-data';
import { Card } from '@/components/ui';
import { Icon, type IconName } from '@/components/ui/Icons';

export function Features() {
  return (
    <section className="section bg-bg-secondary" aria-labelledby="features-heading">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto mb-12 lg:mb-16">
          <p className="text-xs font-semibold text-brand-primary uppercase tracking-wider mb-3">
            Why FlyWithSafe
          </p>
          <h2 id="features-heading" className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
            Confidence at every step of your journey
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature) => (
            <Card
              key={feature.id}
              variant="default"
              padding="lg"
              hover
              className="h-full"
            >
              <div className="flex flex-col h-full">
                <div
                  className="w-12 h-12 rounded-xs bg-brand-primary/10 flex items-center justify-center mb-4 text-brand-primary"
                  aria-hidden="true"
                >
                  <Icon name={feature.icon as IconName} size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-text-primary mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-text-secondary leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}