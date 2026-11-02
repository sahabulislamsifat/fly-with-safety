import { Suspense } from 'react';
import { AuthFlowPage } from '@/components/auth/AuthFlowPage';
export default function ResetPasswordPage() { return <Suspense><AuthFlowPage flow="reset" /></Suspense>; }
