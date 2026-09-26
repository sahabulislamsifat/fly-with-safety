import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar/Navbar";
import { Footer } from "@/components/footer/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FlyWithSafe — Safe & Easy Travel Booking",
  description: "Book flights, hotels, travel packages and get reliable travel support with FlyWithSafe. Your trusted travel partner for seamless journeys.",
  keywords: ["flights", "hotels", "travel packages", "visa assistance", "travel booking", "FlyWithSafe"],
  authors: [{ name: "FlyWithSafe" }],
  creator: "FlyWithSafe",
  publisher: "FlyWithSafe",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://flywithsafe.com",
    siteName: "FlyWithSafe",
    title: "FlyWithSafe — Safe & Easy Travel Booking",
    description: "Book flights, hotels, travel packages and get reliable travel support with FlyWithSafe.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "FlyWithSafe - Travel made reassuring",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FlyWithSafe — Safe & Easy Travel Booking",
    description: "Book flights, hotels, travel packages and get reliable travel support with FlyWithSafe.",
    images: ["/og-image.jpg"],
    creator: "@flywithsafe",
  },
  verification: {
    google: "google-site-verification-code",
  },
  other: {
    "schema.org": JSON.stringify({
      "@context": "https://schema.org",
      "@type": "TravelAgency",
      "name": "FlyWithSafe",
      "url": "https://flywithsafe.com",
      "logo": "https://flywithsafe.com/logo.png",
      "description": "Book flights, hotels, travel packages and get reliable travel support with FlyWithSafe.",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "123 Travel Street, Suite 100",
        "addressLocality": "New York",
        "addressRegion": "NY",
        "postalCode": "10001",
        "addressCountry": "US",
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+1-800-555-0000",
        "contactType": "customer service",
        "availableLanguage": "English",
      },
      "sameAs": [
        "https://facebook.com/flywithsafe",
        "https://instagram.com/flywithsafe",
        "https://wa.me/flywithsafe",
      ],
    }),
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "TravelAgency",
              "name": "FlyWithSafe",
              "url": "https://flywithsafe.com",
              "logo": "https://flywithsafe.com/logo.png",
              "description": "Book flights, hotels, travel packages and get reliable travel support with FlyWithSafe.",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "123 Travel Street, Suite 100",
                "addressLocality": "New York",
                "addressRegion": "NY",
                "postalCode": "10001",
                "addressCountry": "US",
              },
              "contactPoint": {
                "@type": "ContactPoint",
                "telephone": "+1-800-555-0000",
                "contactType": "customer service",
                "availableLanguage": "English",
              },
              "sameAs": [
                "https://facebook.com/flywithsafe",
                "https://instagram.com/flywithsafe",
                "https://wa.me/flywithsafe",
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-white">
        <Navbar />
        <main className="flex-1 pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}