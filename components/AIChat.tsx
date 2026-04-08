
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { PRODUCTS, SIZES } from '../constants';
import { adminService } from '../services/adminService';
import { Product } from '../types';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  isNetwork?: boolean;
  productAction?: Product;
};

export const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { setView, addToCart, currentUser, setAiMetrics, lastAiMetrics } = useStore();

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'init',
        role: 'assistant',
        content: 'SYSTEM ONLINE // TRINITY 4.0. Вектор автономности зафиксирован. Ожидаю ввод данных.'
      }]);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue;
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userText }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await adminService.chatWithAI(
        userText, 
        messages.filter(m => m.role !== 'error').map(m => ({ role: m.role as any, content: m.content })),
        currentUser?.telegram_id
      );

      // response теперь — это { reply, metrics }
      const aiReply = response.reply || "COMM_LINK_ERROR";
      if (response.metrics) {
        setAiMetrics(response.metrics);
      }

      let detectedProduct: Product | undefined;
      const productMatch = aiReply.match(/\[PRODUCT:(.*?)\]/);
      if (productMatch) {
        const productId = productMatch[1].trim();
        detectedProduct = PRODUCTS.find(p => p.id === productId);
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiReply.replace(/\[PRODUCT:.*?\]/g, '').trim(),
        productAction: detectedProduct
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { 
        id: 'err-' + Date.now(), 
        role: 'error', 
        isNetwork: error.isNetworkBlock,
        content: error.message 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-5xl mx-auto w-full border-x-2 border-brand-text bg-brand-bg transition-colors duration-500">
      <div className="p-3 border-b-2 border-brand-text flex justify-between items-center bg-brand-bg/80 backdrop-blur-md">
        <button onClick={() => setView('shop')} className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-60 transition-opacity">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            EXIT_TERMINAL
        </button>
        <div className="flex gap-4">
           <div className="flex flex-col items-end">
              <span className="text-[7px] font-black opacity-40 uppercase">∇ε_Total</span>
              <span className="text-[10px] font-black text-green-500">{(lastAiMetrics.total * 100).toFixed(1)}%</span>
           </div>
           <span className="text-[10px] font-black text-brand-text/40 animate-pulse uppercase flex items-center">TRINITY_LINK</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-brand-bg">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`p-4 border-2 border-brand-text max-w-[85%] text-sm font-bold brutalist-shadow-sm transition-all ${
              msg.role === 'user' ? 'bg-brand-text text-brand-bg' : 'bg-brand-bg text-brand-text'
            }`}>
              {msg.role === 'error' && <span className="text-red-500 mr-2">!</span>}
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
            {msg.productAction && (
              <div className="mt-4 w-64 border-2 border-brand-text bg-brand-bg p-3 brutalist-shadow animate-in zoom-in duration-500">
                <img src={msg.productAction.images[0]} className="w-full h-32 object-cover grayscale mb-2 border border-brand-text" alt="" />
                <h4 className="font-black uppercase text-[10px] mb-2">{msg.productAction.name}</h4>
                <button onClick={() => addToCart(msg.productAction!, SIZES[1])} className="w-full bg-brand-text text-brand-bg py-2 text-[9px] font-black uppercase hover:opacity-80 transition-opacity">ADD TO GEAR +</button>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 bg-brand-text animate-ping"></div>
             <div className="text-[10px] font-black uppercase opacity-40">TRINITY_THINKING...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t-2 border-brand-text bg-brand-bg">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input autoFocus value={inputValue} onChange={(e) => setInputValue(e.target.value)}
            placeholder="ВВЕДИТЕ ЗАПРОС..."
            className="flex-1 bg-transparent border-2 border-brand-text p-4 outline-none font-bold uppercase text-xs focus:bg-brand-text/5 text-brand-text" />
          <button type="submit" disabled={isLoading} className="bg-brand-text text-brand-bg px-8 font-black uppercase text-xs border-2 border-brand-text hover:bg-brand-bg hover:text-brand-text transition-all">SEND</button>
        </form>
      </div>
    </div>
  );
};
