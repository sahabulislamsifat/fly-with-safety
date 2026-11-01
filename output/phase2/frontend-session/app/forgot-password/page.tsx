import { Suspense } from 'react';
import { AuthFlowPage } from '@/components/auth/AuthFlowPage';
export default function ForgotPasswordPage() { return <Suspense><AuthFlowPage flow="forgot" /></Suspense>; }
