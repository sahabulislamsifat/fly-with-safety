import { Suspense } from 'react';
import { AuthFlowPage } from '@/components/auth/AuthFlowPage';
export default function RegisterPage() { return <Suspense><AuthFlowPage flow="register" /></Suspense>; }
