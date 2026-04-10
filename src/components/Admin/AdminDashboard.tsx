
import React, { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { adminService } from '@/services/adminService';
import { Order, Product } from '@/types';
import { AdminAIAssistant } from './AdminAIAssistant';
import { SYSTEM_LOG } from '@/constants/SystemLog';

const ADMIN_SECRET = "zN8u4Yq2Vtq9KpH3s7QbF0xR6yLwM1uGv5aZcT9pH2yVq4nB"; 

export const AdminDashboard: React.FC = () => {
  const { currentUser, setView, lastAiMetrics } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [adminStock, setAdminStock] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'stock' | 'ai' | 'log'>('orders');
  const [loading, setLoading] = useState(false);
  const [trinityOnline, setTrinityOnline] = useState<boolean | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    description: '',
    image_url: '',
    category: 'apparel' as Product['category'],
    stock_quantity: '10'
  });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (currentUser?.telegram_id && currentUser?.is_admin) {
      checkStatus();
      loadData();
    }
  }, [currentUser]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.telegram_id) return;
    setIsCreating(true);
    try {
      await adminService.createProduct({
        ...newProduct,
        price: parseInt(newProduct.price),
        stock_quantity: parseInt(newProduct.stock_quantity),
        is_visible: true
      }, currentUser.telegram_id);
      alert('ТОВАР ДОБАВЛЕН');
      setNewProduct({
        name: '',
        price: '',
        description: '',
        image_url: '',
        category: 'apparel',
        stock_quantity: '10'
      });
      loadData();
    } catch (err) {
      alert('ОШИБКА ПРИ СОЗДАНИИ');
    } finally {
      setIsCreating(false);
    }
  };

  const checkStatus = async () => {
    const isOnline = await adminService.checkTrinityStatus();
    setTrinityOnline(isOnline);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const ordersData = await adminService.fetchOrders(currentUser!.telegram_id);
      setOrders(ordersData);
      const stockRes = await adminService.fetchAdminStock(ADMIN_SECRET);
      setAdminStock(stockRes.stock || []);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-24 font-mono">
      <div className="bg-black text-white p-4 sticky top-0 z-40 flex justify-between items-center">
        <div className="flex items-center gap-6">
            <h1 className="text-xl font-black uppercase tracking-widest">TAK//ADMIN</h1>
            <div className="hidden lg:flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[7px] opacity-40 uppercase">∇ε_Total</span>
                  <span className="text-xs font-black text-green-400">{(lastAiMetrics.total * 100).toFixed(2)}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[7px] opacity-40 uppercase">C-Weight</span>
                  <span className="text-xs font-black text-blue-400">{lastAiMetrics.c.toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[7px] opacity-40 uppercase">D-Weight</span>
                  <span className="text-xs font-black text-red-400">{lastAiMetrics.d.toFixed(2)}</span>
                </div>
            </div>
        </div>
        <button onClick={() => setView('shop')} className="text-[10px] font-bold uppercase border border-white px-3 py-1">Exit</button>
      </div>

      <div className="flex border-b-2 border-black bg-white">
        {(['orders', 'stock', 'ai', 'log'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} 
                className={`flex-1 py-4 font-bold uppercase text-xs transition-colors ${activeTab === tab ? 'bg-black text-white' : 'hover:bg-gray-200 text-black'}`}>
                {tab}
            </button>
        ))}
      </div>

      <div className="p-4 max-w-7xl mx-auto">
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {orders.map((order: any) => (
                <div key={order.id} className="bg-white border-2 border-black p-4 brutalist-shadow-sm flex justify-between items-center">
                  <div>
                    <div className="text-[8px] opacity-40 uppercase">ID: {order.id}</div>
                    <div className="font-black">{order.total_price}₽</div>
                    <div className="text-[10px] uppercase">{order.customer_info?.fullName}</div>
                  </div>
                  <span className="text-[10px] font-black px-2 py-1 border border-black uppercase bg-yellow-400">{order.status}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'stock' && (
            <div className="space-y-8">
              <div className="bg-white border-2 border-black p-6 brutalist-shadow">
                <h3 className="text-lg font-black uppercase mb-6 border-b-2 border-black pb-2">ДОБАВИТЬ НОВЫЙ ТОВАР</h3>
                <form onSubmit={handleCreateProduct} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase mb-1 opacity-50">НАЗВАНИЕ</label>
                      <input 
                        required
                        type="text" 
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                        className="w-full border-2 border-black p-3 font-bold uppercase text-xs outline-none focus:bg-gray-50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase mb-1 opacity-50">ЦЕНА (₽)</label>
                        <input 
                          required
                          type="number" 
                          value={newProduct.price}
                          onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                          className="w-full border-2 border-black p-3 font-bold uppercase text-xs outline-none focus:bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase mb-1 opacity-50">КОЛ-ВО</label>
                        <input 
                          required
                          type="number" 
                          value={newProduct.stock_quantity}
                          onChange={(e) => setNewProduct({...newProduct, stock_quantity: e.target.value})}
                          className="w-full border-2 border-black p-3 font-bold uppercase text-xs outline-none focus:bg-gray-50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase mb-1 opacity-50">КАТЕГОРИЯ</label>
                      <select 
                        value={newProduct.category}
                        onChange={(e) => setNewProduct({...newProduct, category: e.target.value as any})}
                        className="w-full border-2 border-black p-3 font-bold uppercase text-xs outline-none focus:bg-gray-50"
                      >
                        <option value="apparel">ОДЕЖДА</option>
                        <option value="longsleeve">ЛОНГСЛИВ</option>
                        <option value="gear">СНАРЯЖЕНИЕ</option>
                        <option value="accessories">АКСЕССУАРЫ</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase mb-1 opacity-50">URL ФОТО</label>
                      <input 
                        required
                        type="url" 
                        value={newProduct.image_url}
                        onChange={(e) => setNewProduct({...newProduct, image_url: e.target.value})}
                        className="w-full border-2 border-black p-3 font-bold uppercase text-xs outline-none focus:bg-gray-50"
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase mb-1 opacity-50">ОПИСАНИЕ</label>
                      <textarea 
                        required
                        rows={4}
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                        className="w-full border-2 border-black p-3 font-bold uppercase text-xs outline-none focus:bg-gray-50 resize-none"
                      />
                    </div>
                    <button 
                      disabled={isCreating}
                      type="submit"
                      className="w-full bg-black text-white py-4 font-black uppercase tracking-widest text-xs hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {isCreating ? 'СОЗДАНИЕ...' : 'СОЗДАТЬ ТОВАР'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white border-2 border-black p-6 brutalist-shadow">
                 <h3 className="text-lg font-black uppercase mb-6 border-b-2 border-black pb-2">ИНВЕНТАРЬ</h3>
                 <table className="w-full text-left text-[10px] uppercase font-bold">
                  <thead className="border-b-2 border-black">
                    <tr><th className="py-2">SKU</th><th className="py-2">NAME</th><th className="py-2">STOCK</th></tr>
                  </thead>
                  <tbody>
                    {adminStock.map((s) => (
                      <tr key={s.id} className="border-b border-gray-100">
                        <td className="py-2 opacity-40">{s.id}</td>
                        <td className="py-2">{s.name}</td>
                        <td className="py-2">{s.stock_quantity}</td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>
          )}

          {activeTab === 'ai' && <AdminAIAssistant />}

          {activeTab === 'log' && (
            <div className="bg-black text-white p-6 border-4 border-black brutalist-shadow space-y-6">
              <h2 className="text-xl font-black uppercase tracking-widest">MANIFEST</h2>
              {SYSTEM_LOG.map((log, i) => (
                <div key={i} className="border-l-2 border-white/20 pl-4">
                  <div className="text-[8px] opacity-40">{log.date} // v{log.version}</div>
                  <div className="text-xs font-black uppercase text-green-400">{log.action}</div>
                  <p className="text-[10px] opacity-70 uppercase">{log.description}</p>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
};
