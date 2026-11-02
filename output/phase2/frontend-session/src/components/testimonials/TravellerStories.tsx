'use client';

import { motion } from 'framer-motion';
import { testimonials } from '@/lib/data/site-data';
import { Icon } from '@/components/ui/Icons';

export function TravellerStories() {
  return (
    <section className="py-14 sm:py-20 bg-white border-t border-neutral-200" aria-labelledby="testimonials-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header & Review Summary */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-xs bg-[#8B1D24]" />
              <p className="text-xs font-bold text-[#8B1D24] uppercase tracking-wider">
                Community Feedback
              </p>
            </div>
            <h2 id="testimonials-heading" className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-neutral-900 tracking-tight">
              Loved By Travellers Like You
            </h2>
            <p className="text-neutral-500 text-sm sm:text-base mt-2 max-w-xl">
              Authentic traveler experiences with our fast ticket issuance, hassle-free booking desk, and attentive visa support.
            </p>
          </div>

          {/* Rating Summary Badge */}
          <div className="flex items-center gap-3.5 p-3.5 rounded-xs bg-slate-50 border border-neutral-200/80 shadow-2xs shrink-0 self-start sm:self-end">
            <div className="w-10 h-10 rounded-xs bg-amber-400/20 text-amber-600 flex items-center justify-center font-bold text-sm">
              <Icon name="star" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold text-neutral-900">4.9 / 5.0</span>
                <span className="text-xs text-neutral-500">Traveler Rating</span>
              </div>
              <p className="text-[11px] text-neutral-400">Based on verified customer journeys</p>
            </div>
          </div>
        </div>

        {/* Testimonials Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((item, idx) => (
            <motion.article
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: idx * 0.08, ease: 'easeOut' }}
              className="bg-white border border-neutral-200 rounded-xs p-5 sm:p-6 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                {/* 5-star row */}
                <div className="flex items-center gap-1 text-amber-400 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Icon key={i} name="star" size={14} />
                  ))}
                </div>

                <blockquote className="text-xs sm:text-sm text-neutral-700 leading-relaxed italic mb-6">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
              </div>

              <div className="pt-4 border-t border-neutral-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xs bg-neutral-900 text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                  {item.author.charAt(0)}
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-neutral-900 truncate">
                    {item.author}
                  </p>
                  {item.role && (
                    <p className="text-[11px] text-neutral-500 truncate">
                      {item.role}
                    </p>
                  )}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
