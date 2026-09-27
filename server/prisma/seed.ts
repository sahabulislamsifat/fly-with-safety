/**
 * FlyWithSafe Database Seed — DEVELOPMENT/DEMO DATA ONLY
 *
 * All content seeded here is sample data. Replace with verified agency data
 * before production use.
 *
 * Run: pnpm db:seed
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  console.log('🌱 Starting database seed...');

  // ─── Destinations ─────────────────────────────────────────────────────────

  const bangkokDest = await prisma.destination.upsert({
    where: { slug: 'bangkok' },
    update: {},
    create: {
      slug: 'bangkok',
      name: 'Bangkok',
      country: 'Thailand',
      description: 'Vibrant capital with temples, markets, world-class cuisine and legendary nightlife.',
      startingPrice: 199,
      image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&h=600&fit=crop',
      featured: true,
      status: 'PUBLISHED',
    },
  });

  const klDest = await prisma.destination.upsert({
    where: { slug: 'kuala-lumpur' },
    update: {},
    create: {
      slug: 'kuala-lumpur',
      name: 'Kuala Lumpur',
      country: 'Malaysia',
      description: 'Modern metropolis with iconic twin towers, fantastic street food and diverse culture.',
      startingPrice: 250,
      image: 'https://images.unsplash.com/photo-1596422846543-75c6fc1ac79f?w=800&h=600&fit=crop',
      featured: true,
      status: 'PUBLISHED',
    },
  });

  const coxsDest = await prisma.destination.upsert({
    where: { slug: 'coxs-bazar' },
    update: {},
    create: {
      slug: 'coxs-bazar',
      name: "Cox's Bazar",
      country: 'Bangladesh',
      description: "World's longest natural sandy beach with golden sands stretching 120 km.",
      startingPrice: 50,
      image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&h=600&fit=crop',
      featured: true,
      status: 'PUBLISHED',
    },
  });

  await prisma.destination.upsert({
    where: { slug: 'dubai' },
    update: {},
    create: {
      slug: 'dubai',
      name: 'Dubai',
      country: 'UAE',
      description: 'Futuristic skyline, luxury shopping and desert adventures in the heart of the Gulf.',
      startingPrice: 450,
      image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&h=600&fit=crop',
      featured: false,
      status: 'PUBLISHED',
    },
  });

  await prisma.destination.upsert({
    where: { slug: 'singapore' },
    update: {},
    create: {
      slug: 'singapore',
      name: 'Singapore',
      country: 'Singapore',
      description: 'Garden city with world-class food, efficient transport and spectacular architecture.',
      startingPrice: 380,
      image: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&h=600&fit=crop',
      featured: false,
      status: 'PUBLISHED',
    },
  });

  console.log('✅ Destinations seeded');

  // ─── Packages ─────────────────────────────────────────────────────────────

  await prisma.package.upsert({
    where: { slug: 'bangkok-5-days' },
    update: {},
    create: {
      slug: 'bangkok-5-days',
      title: 'Bangkok Explorer — 5 Days',
      destinationId: bangkokDest.id,
      description: "Discover Bangkok's temples, markets and street food on this immersive 5-day guided tour.",
      price: 799,
      durationDays: 5,
      featuredImage: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&h=600&fit=crop',
      inclusions: ['Return flights from DAC', 'Hotel accommodation', 'Daily breakfast', 'Airport transfers', 'Temple tour', 'Thai cooking class'],
      exclusions: ['Travel insurance', 'Personal expenses', 'Lunch and dinner', 'Optional excursions'],
      featured: true,
      status: 'PUBLISHED',
    },
  });

  await prisma.package.upsert({
    where: { slug: 'kuala-lumpur-4-days' },
    update: {},
    create: {
      slug: 'kuala-lumpur-4-days',
      title: 'Kuala Lumpur City Break — 4 Days',
      destinationId: klDest.id,
      description: "Experience KL's highlights including the Petronas Towers, Batu Caves and vibrant night markets.",
      price: 649,
      durationDays: 4,
      featuredImage: 'https://images.unsplash.com/photo-1596422846543-75c6fc1ac79f?w=800&h=600&fit=crop',
      inclusions: ['Return flights from DAC', '4-star hotel', 'Daily breakfast', 'Petronas Towers tour', 'Batu Caves visit', 'City transfers'],
      exclusions: ['Travel insurance', 'Personal expenses', 'Meals except breakfast', 'Optional activities'],
      featured: true,
      status: 'PUBLISHED',
    },
  });

  await prisma.package.upsert({
    where: { slug: 'coxs-bazar-3-days' },
    update: {},
    create: {
      slug: 'coxs-bazar-3-days',
      title: "Cox's Bazar Beach Retreat — 3 Days",
      destinationId: coxsDest.id,
      description: "Relax on the world's longest natural beach with comfortable accommodation and guided coastal tours.",
      price: 149,
      durationDays: 3,
      featuredImage: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&h=600&fit=crop',
      inclusions: ['Bus/train transport from Dhaka', 'Beach resort stay', 'Daily breakfast', 'Sunset beach walk', 'Local guide'],
      exclusions: ['Travel insurance', 'Personal expenses', 'Lunch and dinner'],
      featured: true,
      status: 'PUBLISHED',
    },
  });

  console.log('✅ Packages seeded');

  // ─── Visa Info — SAMPLE DATA, verify before going live ────────────────────

  await prisma.visaInfo.upsert({
    where: { country: 'Thailand' },
    update: {},
    create: {
      country: 'Thailand',
      slug: 'thailand',
      visaRequired: false,
      processingTime: 'On arrival (30 days)',
      fee: 'Free',
      documents: ['Valid passport (6+ months)', 'Return ticket', 'Proof of accommodation', 'Sufficient funds'],
      notes: '[SAMPLE] Verify current requirements with the Thai Embassy before travel.',
      status: 'PUBLISHED',
    },
  });

  await prisma.visaInfo.upsert({
    where: { country: 'Malaysia' },
    update: {},
    create: {
      country: 'Malaysia',
      slug: 'malaysia',
      visaRequired: false,
      processingTime: 'On arrival (30 days)',
      fee: 'Free',
      documents: ['Valid passport (6+ months)', 'Return ticket', 'Proof of funds'],
      notes: '[SAMPLE] Verify current requirements with the Malaysian Embassy.',
      status: 'PUBLISHED',
    },
  });

  await prisma.visaInfo.upsert({
    where: { country: 'UAE' },
    update: {},
    create: {
      country: 'UAE',
      slug: 'uae',
      visaRequired: true,
      processingTime: '3-5 working days',
      fee: 'USD 90-120',
      documents: ['Valid passport (6+ months)', 'Passport-sized photo', 'Bank statement (3 months)', 'Return ticket', 'Hotel booking confirmation'],
      notes: '[SAMPLE] UAE visa required. Our team can assist with the application process.',
      status: 'PUBLISHED',
    },
  });

  await prisma.visaInfo.upsert({
    where: { country: 'Singapore' },
    update: {},
    create: {
      country: 'Singapore',
      slug: 'singapore',
      visaRequired: true,
      processingTime: '5-7 working days',
      fee: 'USD 30-50',
      documents: ['Valid passport (6+ months)', 'Application form', 'Photo', 'Bank statement', 'Return ticket', 'Accommodation proof'],
      notes: '[SAMPLE] Apply through Singapore Embassy or authorised agent.',
      status: 'PUBLISHED',
    },
  });

  console.log('✅ Visa info seeded (sample data — verify before live)');

  // ─── Testimonials ─────────────────────────────────────────────────────────

  await prisma.testimonial.upsert({
    where: { id: 'seed-testimonial-1' },
    update: {},
    create: {
      id: 'seed-testimonial-1',
      quote: 'Booking my flight was super fast and hassle-free! The team helped me find the best deal and I had my e-ticket within minutes.',
      author: 'Sarah Ahmed',
      role: 'Frequent Traveler',
      rating: 5,
      status: 'APPROVED',
    },
  });

  await prisma.testimonial.upsert({
    where: { id: 'seed-testimonial-2' },
    update: {},
    create: {
      id: 'seed-testimonial-2',
      quote: "I've used many travel agencies but FlyWithSafe stands out for their transparency and support. Highly recommended!",
      author: 'Mohammad Rahman',
      role: 'Business Traveler',
      rating: 5,
      status: 'APPROVED',
    },
  });

  await prisma.testimonial.upsert({
    where: { id: 'seed-testimonial-3' },
    update: {},
    create: {
      id: 'seed-testimonial-3',
      quote: 'The visa assistance was incredibly helpful. They guided me through the entire process and made it stress-free.',
      author: 'Priya Sharma',
      role: 'Tourist',
      rating: 5,
      status: 'APPROVED',
    },
  });

  console.log('✅ Testimonials seeded');

  // ─── Admin User (Development Only) ────────────────────────────────────────

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: 'ADMIN' },
      create: {
        email: adminEmail,
        password: hashedPassword,
        name: 'Admin',
        role: 'ADMIN',
        emailVerified: true,
      },
    });
    console.log(`✅ Admin user: ${admin.email}`);
  } else {
    console.log('ℹ️  Skipping admin user (ADMIN_EMAIL/ADMIN_PASSWORD not set)');
  }

  console.log('🎉 Seed completed!');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
