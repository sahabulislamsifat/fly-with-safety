import { Metadata } from 'next';
import { AdminPortal } from '@/components/admin/AdminPortal';

export const metadata: Metadata = {
  title: 'Staff & Admin Operations Portal | FlyWithSafety',
  description: 'Operations management portal for FlyWithSafety staff and administrators.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage() {
  return <AdminPortal />;
}
