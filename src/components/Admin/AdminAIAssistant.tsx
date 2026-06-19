import React, { useState, useRef, useEffect } from 'react';
import { adminService } from '@/services/adminService';
import { useStore } from '@/store';
import { Paperclip, Loader2, Link2, X, FileSpreadsheet, FileText, Image as ImageIcon } from 'lucide-react';

interface Attachment {
  name: string;
  mimeType: string;
  data: string; // base64 representation
  text?: string;
  isDrive?: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
}

export const AdminAIAssistant: React.FC = () => {
  const { currentUser } = useStore();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'MCP TRINITY SYSTEM INITIALIZED. WAITING FOR COMMANDS. ТЕПЕРЬ ПОДДЕРЖИВАЕТСЯ ЗАГРУЗКА ИЗОБРАЖЕНИЙ, ТАБЛИЦ И СВЯЗЬ С GOOGLE DRIVE.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [driveUrl, setDriveUrl] = useState('');
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mcpPlugins = [
    { name: 'Serena', color: 'bg-green-500', desc: 'Code Indexer' },
    { name: 'Supabase', color: 'bg-emerald-400', desc: 'DB Manager' },
    { name: 'Context7', color: 'bg-purple-500', desc: 'Docs Expert' },
    { name: 'Sentry', color: 'bg-indigo-600', desc: 'Error Doc' }
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || loading) return;
    
    const userMsg = input;
    const currentAttachments = [...attachments];
    
    setMessages(prev => [...prev, { role: 'user', content: userMsg || "[Вложение без текста]", attachments: currentAttachments }]);
    setInput('');
    setAttachments([]);
    setLoading(true);
    
    try {
      const response = await adminService.chatWithAdminAI(userMsg, messages, currentUser?.telegram_id, currentAttachments);
      setMessages(prev => [...prev, { role: 'assistant', content: response.reply || "SYSTEM ERROR" }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `CRITICAL FAILURE: ${error.message}` }]);
    } finally {
      setLoading(false);
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

  const handleDriveImport = async () => {
    if (!driveUrl.trim() || driveLoading) return;
    setDriveLoading(true);
    setDriveError('');
    try {
      const responseData = await adminService.fetchGoogleDriveFile(driveUrl);
      
      const newAttachment: Attachment = {
        name: responseData.name || 'Google Drive File',
        mimeType: responseData.mimeType || 'application/octet-stream',
        data: responseData.data || '',
        text: responseData.text,
        isDrive: true
      };
      
      setAttachments(prev => [...prev, newAttachment]);
      setDriveUrl('');
      setIsDriveModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setDriveError(err.message || 'Error occurred while loading Google Drive file. Ensure file sharing is open.');
    } finally {
      setDriveLoading(false);
    }
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
      className={`flex flex-col h-[700px] bg-white border-4 border-black brutalist-shadow transition-all relative ${isDragging ? 'border-dashed border-zinc-500 bg-zinc-50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-3 bg-gray-100 border-b-2 border-black flex gap-2 overflow-x-auto no-scrollbar">
        {mcpPlugins.map(p => (
          <div key={p.name} className="flex flex-col items-center">
             <div className={`${p.color} text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase mb-1 shadow-sm`}>{p.name}</div>
             <div className="text-[7px] font-mono opacity-50 uppercase">{p.desc}</div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-black text-white border-b-2 border-black flex justify-between items-center">
        <div>
            <h2 className="text-xl font-black uppercase tracking-widest">TRINITY ADMIN MCP</h2>
            <p className="text-[10px] font-mono opacity-70">CONTROL MODE: ENABLED | COHERENCE: MAX</p>
        </div>
        {loading && <Loader2 className="animate-spin w-4 h-4 text-white" />}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f8f8f8]">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in duration-300`}>
            <span className="text-[8px] font-black uppercase mb-1 opacity-40 px-1">{msg.role}</span>
            <div className={`p-4 border-2 border-black max-w-[85%] font-mono text-xs brutalist-shadow-sm ${msg.role === 'user' ? 'bg-black text-white' : 'bg-white text-black'}`}>
              <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
              
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mt-3 border-t border-dashed border-zinc-400 pt-2 flex flex-wrap gap-2">
                  {msg.attachments.map((att, idx) => (
                    <div key={idx} className={`flex items-center gap-1.5 p-1.5 border border-black text-[9px] font-bold ${msg.role === 'user' ? 'bg-zinc-800 text-white border-white' : 'bg-zinc-200 text-black border-black'}`}>
                      {att.mimeType.startsWith('image/') ? (
                        <>
                          <ImageIcon size={12} />
                          <img src={`data:${att.mimeType};base64,${att.data}`} alt="" className="w-6 h-6 object-cover border border-black" />
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
          </div>
        ))}
        {isDragging && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-dashed border-black m-2">
            <Paperclip size={48} className="animate-bounce mb-2 text-white" />
            <span className="text-white uppercase font-black text-xs tracking-wider">ПЕРЕТАЩИТЕ СЮДА ФАЙЛЫ ДЛЯ TRINITY CORE</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {driveLoading && (
        <div className="p-3 bg-zinc-900 text-white font-mono text-[10px] uppercase border-t-2 border-black flex items-center gap-2">
          <Loader2 className="animate-spin w-3 h-3 text-white" />
          <span>СКАЧИВАНИЕ ИНФОРМАЦИИ ИЗ GOOGLE DRIVE...</span>
        </div>
      )}

      {/* Google Drive Link Modal / Input */}
      {isDriveModalOpen && (
        <div className="p-4 bg-zinc-100 border-t-4 border-black font-mono">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black uppercase">ИМПОРТ ИЗ GOOGLE ДИСКА</span>
            <button onClick={() => setIsDriveModalOpen(false)} className="hover:opacity-75"><X size={14} /></button>
          </div>
          <p className="text-[10px] mb-2 opacity-70">
            Вставьте общую ссылку на Google Таблицу (.csv), Google Документ (.txt) или изображение. Файл должен быть доступен по ссылке ("Все, у кого есть ссылка").
          </p>
          <div className="flex gap-2">
            <input 
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="flex-1 p-2 border-2 border-black text-[10px] uppercase font-bold bg-white"
            />
            <button 
              onClick={handleDriveImport} 
              disabled={driveLoading || !driveUrl.trim()}
              className="px-4 bg-black text-white text-[10px] uppercase font-bold border-2 border-black hover:invert"
            >
              ИМПОРТ
            </button>
          </div>
          {driveError && <p className="mt-2 text-[10px] font-black text-red-600 uppercase">{driveError}</p>}
        </div>
      )}

      {/* Attachment shelf */}
      {attachments.length > 0 && (
        <div className="p-3 bg-zinc-50 border-t-4 border-black flex flex-wrap gap-2">
          {attachments.map((att, index) => (
            <div key={index} className="flex items-center gap-2 p-1.5 bg-white border-2 border-black brutalist-shadow-sm text-[10px] font-bold">
              {att.mimeType.startsWith('image/') ? (
                <img src={`data:${att.mimeType};base64,${att.data}`} alt="" className="w-6 h-6 object-cover border border-black" />
              ) : att.name.endsWith('.csv') ? (
                <FileSpreadsheet size={14} className="text-green-600" />
              ) : (
                <FileText size={14} className="text-zinc-600" />
              )}
              <span className="max-w-[150px] truncate">{att.name}</span>
              <button onClick={() => removeAttachment(index)} className="p-0.5 hover:bg-zinc-100 rounded text-red-600">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      
      <div className="p-4 bg-white border-t-4 border-black flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="COMMAND / SQL / ВВЕДИТЕ ЗАПРОС..."
          className="flex-1 p-4 border-2 border-black font-bold uppercase text-xs focus:bg-gray-50 outline-none"
          disabled={loading}
        />
        
        {/* Attachment & Drive buttons */}
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
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            title="Прикрепить локальный файл"
            className="p-3 border-2 border-black bg-white hover:bg-neutral-100 transition-all active:scale-95 flex items-center justify-center"
          >
            <Paperclip size={16} />
          </button>
          
          <button
            onClick={() => setIsDriveModalOpen(!isDriveModalOpen)}
            disabled={loading}
            title="Подключить файл из Google Диска"
            className="p-3 border-2 border-black bg-white hover:bg-neutral-100 transition-all active:scale-95 flex items-center justify-center"
          >
            <Link2 size={16} className="text-blue-600" />
          </button>
        </div>

        <button
          onClick={handleSendMessage}
          disabled={loading}
          className="px-8 border-2 border-black bg-black text-white font-black uppercase text-xs hover:invert transition-all active:scale-95"
        >
          EXEC
        </button>
      </div>
    </div>
  );
}
