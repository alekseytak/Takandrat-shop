import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store';
import { PRODUCTS, SIZES } from '@/constants';
import { adminService } from '@/services/adminService';
import { Product } from '../types';
import { Paperclip, X, FileSpreadsheet, FileText, Image as ImageIcon } from 'lucide-react';

interface Attachment {
  name: string;
  mimeType: string;
  data: string; // base64
  text?: string;
  isDrive?: boolean;
}

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  isNetwork?: boolean;
  productAction?: Product;
  attachments?: Attachment[];
};

export const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setView, addToCart, currentUser, setAiMetrics, lastAiMetrics } = useStore();

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'init',
        role: 'assistant',
        content: 'Приветствую. Я ИИ-консультант TRINITY 4.0. Помогу подобрать кожаную экипировку, рассчитать размеры по вашим меркам или спроектировать уникальный кастомный аксессуар. Загружайте эскизы, ТЗ или фото — я готова составить техническое задание.'
      }]);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputValue.trim() && attachments.length === 0) || isLoading) return;

    const userText = inputValue;
    const currentAttachments = [...attachments];

    setMessages(prev => [...prev, { 
      id: Date.now().toString(), 
      role: 'user', 
      content: userText || "[Вложенный файл]", 
      attachments: currentAttachments 
    }]);
    setInputValue('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const response = await adminService.chatWithAI(
        userText, 
        messages.filter(m => m.role !== 'error').map(m => ({ role: m.role as any, content: m.content })),
        currentUser?.telegram_id,
        currentAttachments
      );

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    processFiles(files);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFiles = (files: FileList) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      const isText = file.type.startsWith('text/') || file.name.endsWith('.csv') || file.name.endsWith('.json');
      
      reader.onload = (event) => {
        const resultString = event.target?.result as string;
        let base64Data = '';
        let fileTextContent: string | undefined = undefined;

        if (isText) {
          fileTextContent = resultString;
          base64Data = btoa(unescape(encodeURIComponent(resultString)));
        } else {
          const parts = resultString.split(',');
          base64Data = parts[1] || parts[0];
        }

        const newAttachment: Attachment = {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: base64Data,
          text: fileTextContent
        };

        setAttachments(prev => [...prev, newAttachment]);
      };

      if (isText) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div 
      className={`flex flex-col h-[calc(100vh-64px)] max-w-5xl mx-auto w-full border-x-2 border-brand-text bg-brand-bg transition-all relative ${
        isDragging ? 'bg-brand-text/5 border-dashed border-brand-text' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-3 border-b-2 border-brand-text flex justify-between items-center bg-brand-bg/80 backdrop-blur-md">
        <button onClick={() => setView('shop')} className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-60 transition-opacity">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            ВЫХОД ИЗ ТЕРМИНАЛА
        </button>
        <div className="flex gap-4">
           <div className="flex flex-col items-end">
              <span className="text-[7px] font-black opacity-40 uppercase">∇ε_Total</span>
              <span className="text-[10px] font-black text-green-500">{(lastAiMetrics.total * 100).toFixed(1)}%</span>
           </div>
           <span className="text-[10px] font-black text-brand-text/40 animate-pulse uppercase flex items-center">СВЯЗЬ С ТРИНИТИ</span>
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

              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mt-3 border-t border-dashed border-brand-text/30 pt-2 flex flex-wrap gap-2">
                  {msg.attachments.map((att, idx) => (
                    <div key={idx} className={`flex items-center gap-1.5 p-1.5 border text-[9px] font-bold ${
                      msg.role === 'user' ? 'bg-black/10 text-brand-bg border-brand-bg/40' : 'bg-brand-text/10 text-brand-text border-brand-text/40'
                    }`}>
                      {att.mimeType.startsWith('image/') ? (
                        <>
                          <ImageIcon size={12} />
                          <img src={`data:${att.mimeType};base64,${att.data}`} alt="" className="w-6 h-6 object-cover border border-current" />
                        </>
                      ) : att.mimeType.includes('csv') || att.name.endsWith('.csv') ? (
                        <FileSpreadsheet size={12} />
                      ) : (
                        <FileText size={12} />
                      )}
                      <span className="truncate max-w-[120px]">{att.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {msg.productAction && (
              <div className="mt-4 w-64 border-2 border-brand-text bg-brand-bg p-3 brutalist-shadow animate-in zoom-in duration-500">
                <img src={msg.productAction.images[0]} className="w-full h-32 object-cover grayscale mb-2 border border-brand-text" alt="" />
                <h4 className="font-black uppercase text-[10px] mb-2">{msg.productAction.name}</h4>
                <button onClick={() => addToCart(msg.productAction!, SIZES[1])} className="w-full bg-brand-text text-brand-bg py-2 text-[9px] font-black uppercase hover:opacity-80 transition-opacity">ДОБАВИТЬ В СНАРЯЖЕНИЕ +</button>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 bg-brand-text animate-ping"></div>
             <div className="text-[10px] font-black uppercase opacity-40">ТРИНИТИ ДУМАЕТ...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment shelf */}
      {attachments.length > 0 && (
        <div className="p-3 bg-brand-bg border-t-2 border-brand-text flex flex-wrap gap-2 text-brand-text">
          {attachments.map((att, index) => (
            <div key={index} className="flex items-center gap-2 p-1.5 bg-brand-bg border-2 border-brand-text brutalist-shadow-sm text-[10px] font-bold">
              {att.mimeType.startsWith('image/') ? (
                <img src={`data:${att.mimeType};base64,${att.data}`} alt="" className="w-6 h-6 object-cover border border-brand-text" />
              ) : att.name.endsWith('.csv') ? (
                <FileSpreadsheet size={14} className="text-emerald-500" />
              ) : (
                <FileText size={14} />
              )}
              <span className="max-w-[150px] truncate">{att.name}</span>
              <button onClick={() => removeAttachment(index)} className="p-0.5 hover:bg-brand-text/10 rounded text-red-500">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 border-t-2 border-brand-text bg-brand-bg">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input autoFocus value={inputValue} onChange={(e) => setInputValue(e.target.value)}
            placeholder="ВВЕДИТЕ ЗАПРОС ИЛИ ПЕРЕТАЩИТЕ СЮДА ФАЙЛЫ..."
            className="flex-1 bg-transparent border-2 border-brand-text p-4 outline-none font-bold uppercase text-xs focus:bg-brand-text/5 text-brand-text" />
          
          <div className="flex gap-1.5">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              multiple 
              accept="image/*,text/*,.csv,.json"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Прикрепить локальный файл"
              className="p-3 border-2 border-brand-text bg-transparent hover:bg-brand-text/5 text-brand-text transition-all active:scale-95 flex items-center justify-center bg-brand-bg"
            >
              <Paperclip size={16} />
            </button>
          </div>

          <button type="submit" disabled={isLoading} className="bg-brand-text text-brand-bg px-8 font-black uppercase text-xs border-2 border-brand-text hover:bg-brand-bg hover:text-brand-text transition-all">ОТПРАВИТЬ</button>
        </form>
      </div>
    </div>
  );
};
