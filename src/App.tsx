import React, { useEffect } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { ProductGrid } from './components/Store/ProductGrid';
import { CorporatePage } from './components/CorporatePage';
import { Cart } from './components/Cart';
import { Checkout } from './components/Checkout';
import { Footer } from './components/Footer';
import { AIChat } from './components/AIChat';
import { InfoPage } from './components/InfoPage';
import { Concept } from './components/Concept';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { useStore } from './store';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        backgroundColor: string;
        headerColor: string;
        initData: string;
        initDataUnsafe: {
           user?: {
             id: number;
             first_name: string;
             last_name?: string;
             username?: string;
           }
        };
        sendData: (data: string) => void;
      };
    };
  }
}

const App: React.FC = () => {
  const { view, syncUser, theme } = useStore();

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.backgroundColor = theme === 'light' ? '#ffffff' : '#000000';
      tg.headerColor = theme === 'light' ? '#ffffff' : '#000000';

      if (tg.initDataUnsafe?.user) {
        syncUser(tg.initDataUnsafe.user);
      }
    }
  }, [theme]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  if (view === 'admin') {
      return <AdminDashboard />;
  }

  return (
    <div className="min-h-screen flex flex-col selection:bg-brand-text selection:text-brand-bg relative bg-brand-bg text-brand-text transition-colors duration-300">
      <Header />
      
      <main className="flex-grow flex flex-col">
        {view === 'shop' && (
          <>
            <Hero />
            <ProductGrid />
            <Concept />
          </>
        )}
        
        {view === 'corporate' && <CorporatePage />}
        
        {view === 'cart' && <Cart />}

        {view === 'checkout' && <Checkout />}
        
        {view === 'chat' && <AIChat />}

        {view === 'info' && <InfoPage />}
      </main>

      {view !== 'chat' && <Footer />}

      <div className="fixed inset-0 pointer-events-none border-x-2 border-brand-text/5 mx-auto max-w-7xl z-[-1]" />
    </div>
  );
};

export default App;