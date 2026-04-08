
import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { BRAND_NAME } from '../constants';
import { TorusLogo } from './TorusLogo';
import { AILogo } from './AILogo';

const ADMIN_PIN = "7476";

export const Header: React.FC = () => {
  const { view, setView, cart, currentUser, forceAdmin, theme, toggleTheme } = useStore();
  const totalItemsInCart = cart.reduce((sum, item) => sum + item.quantity, 0);

  const [logoClicks, setLogoClicks] = useState(0);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    if (logoClicks > 0 && logoClicks < 5) {
        const timer = setTimeout(() => setLogoClicks(0), 2000);
        return () => clearTimeout(timer);
    }
  }, [logoClicks]);

  const handleLogoClick = () => {
    const newCount = logoClicks + 1;
    setLogoClicks(newCount);

    if (newCount >= 5) {
      setShowPinModal(true);
      setLogoClicks(0);
    } else {
        setView('shop');
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (pinInput === ADMIN_PIN) {
          forceAdmin();
          setView('admin');
          setShowPinModal(false);
          setPinInput('');
          setPinError(false);
      } else {
          setPinError(true);
          setPinInput('');
          setTimeout(() => setPinError(false), 1000);
      }
  };

  return (
    <>
        <header className="sticky top-0 z-50 border-b-2 border-brand-text bg-brand-bg/95 backdrop-blur-md transition-all duration-300">
        <div className="max-w-7xl mx-auto px-3 sm:px-8 py-2 flex justify-between items-center w-full min-h-[60px]">
            <div 
            className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none group"
            onClick={handleLogoClick}
            >
            <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center overflow-visible">
                <TorusLogo className={`w-7 h-7 sm:w-9 h-9 text-brand-text transition-transform duration-500 ${logoClicks > 0 ? 'rotate-90' : ''}`} />
            </div>
            <span className="font-black text-sm sm:text-xl tracking-tighter uppercase text-brand-text leading-none pt-0.5 whitespace-nowrap">
                {BRAND_NAME}
            </span>
            </div>
            
            <nav className="flex gap-2 sm:gap-6 items-center">
            {currentUser?.is_admin && (
                <button 
                onClick={() => setView('admin')}
                className="text-[8px] sm:text-[10px] bg-red-600 text-white uppercase font-black tracking-widest px-2 py-1 mr-1 sm:mr-2 animate-pulse"
                >
                ADM
                </button>
            )}

            <button 
                onClick={toggleTheme}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-brand-text hover:opacity-50 transition-all active:scale-90 border-0 outline-none focus:outline-none"
            >
                {theme === 'light' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
                )}
            </button>

            <button onClick={() => setView('corporate')} className={`text-[8px] sm:text-[10px] uppercase font-black tracking-widest px-2 sm:px-3 py-1.5 sm:py-2 border-2 transition-all ${view === 'corporate' ? 'bg-brand-text text-brand-bg border-brand-text' : 'border-transparent sm:hover:border-brand-text text-brand-text'}`}>
                <span>B2B / МЕРЧ</span>
            </button>

            <button onClick={() => setView('chat')} className={`w-9 h-9 sm:w-12 sm:h-12 transition-transform duration-300 relative group sm:hover:scale-110 flex items-center justify-center ${view === 'chat' ? 'bg-brand-text text-brand-bg' : ''}`}>
                <AILogo className={`w-full h-full ${view === 'chat' ? 'text-brand-bg' : 'text-brand-text'}`} />
            </button>

            <button onClick={() => setView('cart')} className={`relative group p-1 sm:p-1.5 border-2 border-brand-text transition-all ${view === 'cart' ? 'bg-brand-text text-brand-bg' : 'bg-transparent text-brand-text'}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                {totalItemsInCart > 0 && <span className="absolute -top-1.5 -right-1.5 bg-brand-text text-brand-bg text-[8px] w-4 h-4 flex items-center justify-center font-bold border border-brand-bg">{totalItemsInCart}</span>}
            </button>
            </nav>
        </div>
        </header>

        {showPinModal && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 text-black">
                <div className="bg-white border-4 border-black p-8 w-full max-w-xs brutalist-shadow relative">
                    <button onClick={() => setShowPinModal(false)} className="absolute top-2 right-2 text-black hover:bg-black hover:text-white p-1 px-3 font-black">✕</button>
                    <h2 className="text-xl font-black uppercase mb-6 tracking-widest text-center">SECURITY CHECK</h2>
                    <form onSubmit={handlePinSubmit} className="flex flex-col gap-4">
                        <input type="password" maxLength={4} autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="PIN" className={`w-full text-center text-4xl font-black tracking-[0.5em] p-4 border-2 outline-none transition-all ${pinError ? 'border-red-600 bg-red-100 text-red-600' : 'border-black focus:bg-black focus:text-white'}`} />
                        <button type="submit" className="bg-black text-white py-4 font-bold uppercase tracking-widest hover:bg-gray-800">ENTER SYSTEM</button>
                    </form>
                </div>
            </div>
        )}
    </>
  );
};
