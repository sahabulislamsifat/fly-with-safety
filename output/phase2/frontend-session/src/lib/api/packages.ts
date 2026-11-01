import { get, post } from './client';

export interface PackageSummary {
  id: string;
  name: string;
  slug: string;
  durationDays: number;
  price: number;
  currency: string;
  imageUrl: string;
  destination: {
    name: string;
    country: string;
  };
}

export interface PackageInquiryPayload {
  packageId?: string;
  packageSlug?: string;
  packageTitle?: string;
  name: string;
  email: string;
  phone?: string;
  travelDate?: string;
  travellers: number;
  notes?: string;
}

export async function getPackages(): Promise<{ packages: PackageSummary[] }> {
  return get('/packages');
}

export async function getPackageBySlug(slug: string): Promise<{ package: Record<string, unknown> }> {
  return get(`/packages/${slug}`);
}

export async function submitPackageInquiry(payload: PackageInquiryPayload, idempotencyKey: string): Promise<{
  referenceNumber: string;
  inquiry: Record<string, unknown>;
  message: string;
}> {
  return post('/packages/inquiries', payload, { 'Idempotency-Key': idempotencyKey });
}
