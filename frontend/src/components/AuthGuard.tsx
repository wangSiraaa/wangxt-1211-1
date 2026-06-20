'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../store/auth';

export default function AuthGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const { initialized, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      const redirect = encodeURIComponent(pathname || '/');
      router.replace(`/login?next=${redirect}`);
      return;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      router.replace('/');
    }
  }, [initialized, user, router, pathname, allowedRoles]);

  if (!mounted || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-carbon-500 border-t-transparent"></div>
      </div>
    );
  }
  if (!user) return null;
  if (allowedRoles && !allowedRoles.includes(user.role)) return null;
  return <>{children}</>;
}
