import { Suspense } from 'react';
import { AuthFlowPage } from '@/components/auth/AuthFlowPage';
export default function VerifyEmailPage() { return <Suspense><AuthFlowPage flow="verify" /></Suspense>; }
