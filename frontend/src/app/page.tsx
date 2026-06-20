'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../store/auth';
import AuthGuard from '../components/AuthGuard';
import Navbar from '../components/Navbar';

export default function HomePage() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}

function HomeContent() {
  const router = useRouter();
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    switch (user.role) {
      case 'ENTERPRISE':
        router.replace('/enterprise');
        break;
      case 'VERIFIER':
        router.replace('/verifier/tasks');
        break;
      case 'ADMIN':
        router.replace('/admin');
        break;
      default:
        router.replace('/login');
    }
  }, [user, router]);
  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="card text-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-carbon-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500">正在跳转到工作台...</p>
        </div>
      </div>
    </>
  );
}
