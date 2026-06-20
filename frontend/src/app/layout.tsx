import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientProvider from './ClientProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '工业园区碳资产核算系统',
  description: 'Carbon Asset Accounting System for Industrial Parks',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <ClientProvider>{children}</ClientProvider>
      </body>
    </html>
  );
}
