import React from 'react';
import { useStore } from '@/store';
import { adminService } from '@/services/adminService';
import { buildOrderMessage, openOrderChat, orderChatLink, sendOrderToServer } from '@/lib/orderMessage';
import {
  UI_TEXT,
  CRYPTO_WALLETS,
  getProductName,
  getProductPrice,
  formatMoney,
  getInternationalShipping,
} from '@/lib/i18n';

type WalletEntry = { network: string; label: string; address: string };
type PaymentDetails = {
  card: string | null;
  cardRecipient: string | null;
  crypto: string | null;
  cryptoNetwork: string | null;
  wallets?: WalletEntry[];
};

export const Checkout: React.FC = () => {
  const { cart, setView, clearCart, lang, currency } = useStore();
  const t = UI_TEXT[lang];
  const isInternational = lang === 'en' || currency !== 'RUB';
  const subtotal = cart.reduce((sum, item) => sum + getProductPrice(item, currency) * item.quantity, 0);
  const shipping = getInternationalShipping(subtotal, currency, isInternational);
  const total = subtotal + shipping;

  const [payment, setPayment] = React.useState<PaymentDetails | null>(null);
  const [copiedAddr, setCopiedAddr] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** Собранный заказ: показывается, пока покупатель не подтвердит отправку. */
  const [sentOrder, setSentOrder] = React.useState<string | null>(null);
  /** Заказ ушёл мастеру сам, без действий покупателя в Telegram. */
  const [delivered, setDelivered] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/payment-details')
      .then(response => response.ok ? response.json() : Promise.reject(new Error('PAYMENT_DETAILS_UNAVAILABLE')))
      .then(setPayment)
      .catch(() => setPayment({
        card: null,
        cardRecipient: null,
        crypto: CRYPTO_WALLETS[1].address,
        cryptoNetwork: CRYPTO_WALLETS[1].network,
        wallets: [...CRYPTO_WALLETS],
      }));
  }, []);

  const walletsToShow: WalletEntry[] = payment?.wallets?.length
    ? payment.wallets
    : [...CRYPTO_WALLETS];

  const handleCopy = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedAddr(addr);
      setTimeout(() => setCopiedAddr(null), 2000);
    } catch {
      setError(lang === 'en' ? 'Copy failed. Select and copy the address manually.' : 'Не удалось скопировать. Выделите адрес и скопируйте вручную.');
    }
  };

  // Ключ один на всю попытку оформления: он переживает повторное нажатие,
  // поэтому второй заказ не создаётся, если ответ потерялся в сети.
  const idempotencyKeyRef = React.useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `order-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  // Договор с покупателем не меняется (заказ, оплата переводом), меняется
  // способ доставки заказа мастеру: сообщением в Telegram, а не записью в
  // базу. Путь через базу остался и включается переменной VITE_ORDER_MODE.
  const orderMode = String(import.meta.env.VITE_ORDER_MODE || 'telegram');

  const handleCheckout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const form = new FormData(e.currentTarget);
    const address = String(form.get('address') || '');

    // Текст заказа собирает витрина: состав, размер, итог, адрес ПВЗ и кто
    // заказывает. Цены берутся из каталога, как и раньше.
    const draft = buildOrderMessage({
      lines: cart.map(item => ({
        name: getProductName(item, lang),
        quantity: item.quantity,
        price: getProductPrice(item, currency),
        size: item.selectedSize || undefined,
      })),
      total: subtotal,
      shipping,
      currency,
      lang,
      address,
      customerName: useStore.getState().currentUser?.first_name,
    });

    try {
      if (orderMode === 'database' && currency !== 'RUB') {
        throw new Error(lang === 'en' ? 'Foreign-currency database orders are not supported. Contact Alexey for a quote.' : 'Заказ в этой валюте через базу недоступен. Свяжитесь с Алексеем.');
      }
      if (orderMode === 'database') {
        const result = await adminService.createOrder({
          // Личность покупателя не отправляем: сервер берёт её из подписи
          // Telegram. Имя остаётся только для уведомления мастеру.
          customer_name: useStore.getState().currentUser?.first_name || 'Покупатель Telegram',
          phone: '',
          address,
          // Цену не отправляем: её считает сервер по каталогу. Размер отправляем —
          // по нему шьют изделие.
          idempotency_key: idempotencyKeyRef.current,
          items: cart.map(item => ({
            product_id: String(item.db_id ?? item.id),
            quantity: item.quantity,
            size: item.selectedSize || '',
          })),
        });
        alert(`Заказ ${result.order_id} принят. Переведите оплату и пришлите подтверждение в Telegram.`);
        clearCart();
        setView('shop');
        return;
      }

      // Сначала магазин отправляет заказ мастеру сам: токен бота лежит на
      // сервере, покупателю не нужно ничего нажимать. Если сервер не настроен
      // или Telegram отказал — открываем чат с ботом, где текст уже набран.
      const went = await sendOrderToServer(draft);
      setDelivered(went);
      if (!went) openOrderChat(draft);
      setSentOrder(draft);
    } catch (err: any) {
      setError(err?.message || `Не удалось открыть чат. Скопируйте заказ ниже и пришлите его в @${'takandrat_bot'}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto w-full">
      <h2 className="text-2xl font-black uppercase mb-6">{t.checkoutTitle}</h2>
      <form onSubmit={handleCheckout} className="flex flex-col gap-4">
        <input required name="address" type="text" placeholder={t.addressPlaceholder} className="border-2 border-brand-text p-3 bg-transparent font-bold uppercase placeholder:opacity-50" />
        <div className="border-2 border-brand-text">
          {cart.map(item => (
            <div
              key={`${item.id}-${item.selectedSize}`}
              className="flex justify-between gap-3 px-3 py-2 border-b-2 border-brand-text last:border-b-0 text-xs font-bold uppercase"
            >
              <span>{getProductName(item, lang)}{item.selectedSize ? ` / ${item.selectedSize}` : ''}</span>
              <span className="whitespace-nowrap">{item.quantity} × {formatMoney(getProductPrice(item, currency), currency)}</span>
            </div>
          ))}
        </div>
        {isInternational && (
          <div className="flex justify-between items-center text-xs font-bold uppercase opacity-80 pt-2">
            <span>{t.shippingLabel}</span>
            <span>{shipping === 0 ? t.freeShipping : formatMoney(shipping, currency)}</span>
          </div>
        )}
        <div className="mt-4 pt-4 border-t-2 border-brand-text flex justify-between items-center"><span className="font-black uppercase">{t.payTotalLabel}</span><span className="text-xl font-black">{formatMoney(total, currency)}</span></div>
        <div className="mt-6 p-4 border-2 border-brand-text bg-brand-text/5">
          <h3 className="font-black uppercase text-sm mb-3 tracking-widest">{t.paymentHeader}</h3>
          {payment?.card ? <p className="text-sm font-black">{t.cardLabel}: {payment.card}</p> : <p className="text-xs font-bold opacity-60">{t.cardNotSet}</p>}
          {payment?.cardRecipient && <p className="text-xs font-bold mt-1">{t.recipientLabel}: {payment.cardRecipient}</p>}
          <div className="mt-4 pt-3 border-t border-brand-text/20 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest">{t.cryptoWalletsTitle}</p>
            {walletsToShow.map((w) => (
              <div key={w.label} className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                  <span className="opacity-70">{w.network}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(w.address)}
                    className="underline font-black text-[9px] hover:opacity-60"
                  >
                    {copiedAddr === w.address ? t.copiedBtn : t.copyBtn}
                  </button>
                </div>
                <code className="bg-brand-text/10 p-2 text-[10px] font-mono break-all border border-brand-text/20 select-all">
                  {w.address}
                </code>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[9px] font-bold uppercase opacity-60 leading-tight">{t.checkoutNote}</p>
        </div>
        {error && <p role="alert" className="border-2 border-red-600 p-3 text-xs font-bold text-red-600">{error}</p>}
        {sentOrder && (
          <div className="border-2 border-brand-text p-4 flex flex-col gap-3">
            <h3 className="font-black uppercase text-sm tracking-widest" data-testid="order-state">
              {delivered ? t.orderSentTitle : t.orderDraftTitle}
            </h3>
            <p className="text-[10px] font-bold uppercase opacity-70 leading-tight">
              {delivered ? t.orderSentDesc : t.orderDraftDesc}
            </p>
            <pre data-testid="order-draft" className="whitespace-pre-wrap text-[11px] font-bold">{sentOrder}</pre>
            {!delivered && <a href={orderChatLink(sentOrder)} target="_blank" rel="noreferrer" className="w-full text-center border-2 border-brand-text py-3 font-black uppercase tracking-widest hover:bg-brand-text hover:text-brand-bg transition-colors">{t.openBotBtn}</a>}
            <button type="button" onClick={() => { clearCart(); setView('shop'); }} className="w-full bg-brand-text text-brand-bg py-3 font-black uppercase tracking-widest hover:opacity-90 transition-opacity">{delivered ? t.backToShopBtn : t.orderSubmittedBtn}</button>
          </div>
        )}
        <button disabled={isSubmitting} type="submit" className="w-full bg-brand-text text-brand-bg py-4 font-black uppercase tracking-widest mt-4 hover:opacity-90 transition-opacity disabled:opacity-50">{isSubmitting ? t.submittingBtn : t.confirmOrderBtn}</button>
      </form>
    </div>
  );
};
