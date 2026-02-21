
import React, { useState, useRef, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { useStore } from '../../store';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const AdminAIAssistant: React.FC = () => {
  const { currentUser } = useStore();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'MCP TRINITY SYSTEM INITIALIZED. WAITING FOR COMMANDS.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    if (!input.trim() || loading) return;
    
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setLoading(true);
    
    try {
      const response = await adminService.chatWithAI(userMsg, messages, currentUser?.telegram_id);
      // response.reply так как Edge Function возвращает JSON
      setMessages(prev => [...prev, { role: 'assistant', content: response.reply || "SYSTEM ERROR" }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `CRITICAL FAILURE: ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-[700px] bg-white border-4 border-black brutalist-shadow">
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
        {loading && <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f8f8f8]">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in duration-300`}>
            <span className="text-[8px] font-black uppercase mb-1 opacity-40 px-1">{msg.role}</span>
            <div className={`p-4 border-2 border-black max-w-[85%] font-mono text-xs brutalist-shadow-sm ${msg.role === 'user' ? 'bg-black text-white' : 'bg-white text-black'}`}>
              <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 bg-white border-t-4 border-black flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="COMMAND / SQL / SKILL_REQUEST..."
          className="flex-1 p-4 border-2 border-black font-bold uppercase text-xs focus:bg-gray-50 outline-none"
          disabled={loading}
        />
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
