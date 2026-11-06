import { GatewayReturn } from '@/components/booking/GatewayReturn';
export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<{ booking?: string | string[] }> }) {
  const { booking } = await searchParams;
  const reference = typeof booking === 'string' && /^[A-Z0-9-]{3,64}$/.test(booking) ? booking : null;
  return <GatewayReturn reference={reference} />;
}
