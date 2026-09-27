import { testimonials } from '@/lib/data/site-data';
import { Card, CardContent, Icon } from '@/components/ui';

export function Testimonials() {
  return (
    <section className="section bg-bg-secondary" aria-labelledby="testimonials-heading">
      <div className="container">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs font-semibold text-brand-primary uppercase tracking-wider mb-3">
            Customer Stories
          </p>
          <h2
            id="testimonials-heading"
            className="text-3xl sm:text-4xl font-bold text-text-primary mb-10"
          >
            What our travelers say
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card
                key={testimonial.id}
                variant="default"
                padding="lg"
                className={index === 1 ? 'ring ring-brand-primary/20' : ''}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center mb-4" aria-hidden="true">
                    <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                      <Icon name="star" size={24} />
                    </div>
                  </div>
                  <blockquote className="text-lg text-text-secondary leading-relaxed mb-6">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  <footer>
                    <cite className="not-italic">
                      <p className="font-medium text-text-primary">{testimonial.author}</p>
                      {testimonial.role && (
                        <p className="text-sm text-text-tertiary">{testimonial.role}</p>
                      )}
                    </cite>
                  </footer>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
