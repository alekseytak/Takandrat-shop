import { Product } from './types';

export const BRAND_NAME = "tak and rat";
export const BRAND_DESCRIPTION = "РУЧНАЯ РАБОТА. НАТУРАЛЬНАЯ КОЖА И ХЛОПОК. МИНИМАЛИЗМ И ДОЛГОВЕЧНОСТЬ.";

export const CONCEPT_TITLE = " GEAR FOR THE AGE OF UNCERTAINTY";
export const CONCEPT_TEXT = [
  {
    title: "АВТОНОМНОСТЬ",
    text: "МЫ СОЗДАЕМ ИНСТРУМЕНТЫ, КОТОРЫЕ НЕ ТРЕБУЮТ ЗАМЕНЫ КАЖДЫЙ СЕЗОН. ВЕЩИ, КОТОРЫЕ СТАНОВЯТСЯ ВАШЕЙ ЧАСТЬЮ."
  },
  {
    title: "МАТЕРИАЛ",
    text: "ТОЛЬКО НАТУРАЛЬНАЯ КОЖА РАСТИТЕЛЬНОГО ДУБЛЕНИЯ И ПЛОТНЫЙ ХЛОПОК. ТАКТИЛЬНЫЙ КОНТАКТ С РЕАЛЬНОСТЬЮ."
  },
  {
    title: "РУЧНОЙ ТРУД",
    text: "КАЖДЫЙ ШОВ СДЕЛАН ВРУЧНУЮ В САНКТ-ПЕТЕРБУРГЕ. НИКАКОГО МАСС-МАРКЕТА, ТОЛЬКО ОГРАНИЧЕННЫЕ ТИРАЖИ."
  }
];

export const PRODUCTS: Product[] = [
  // LEATHER GEAR
  {
    id: 'ch-01',
    name: 'Картхолдер "VEGETABLE"',
    price: 3800,
    description: 'Итальянская кожа растительного дубления. Компактный аксессуар, который со временем приобретает уникальный характер. Ручной седельный шов, вощеная нить, торцы заполированы воском.',
    images: [
      'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1531938716357-224c16b5ace3?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1605733513597-a8f8341084e6?auto=format&fit=crop&q=80&w=800'
    ],
    category: 'accessories',
    features: ['Vegetable Tanned', 'Handmade Stitch', 'Autonomy Gear']
  },
  {
    id: 'b-01',
    name: 'Браслет B-01',
    price: 2500,
    description: 'Кожа барсук, ширина 25мм. Регулируемый размер. Латунная пряжка. Срок изготовления: 2 дня.',
    images: ['https://images.unsplash.com/photo-1531938716357-224c16b5ace3?auto=format&fit=crop&q=80&w=800'],
    category: 'accessories',
    features: ['Badger Leather', 'Handmade']
  },
  {
    id: 'w-03',
    name: 'Кошелёк W-03',
    price: 4800,
    description: 'Воловья кожа, растительное дубление. 8 отделений для карт. Компактный формат для заднего кармана.',
    images: ['https://images.unsplash.com/photo-1605733513597-a8f8341084e6?auto=format&fit=crop&q=80&w=800'],
    category: 'accessories',
    features: ['Vegetable Tanned', '8 Cards']
  },
  {
    id: 's-07',
    name: 'Ремень S-07',
    price: 3200,
    description: 'Сафьяновая кожа, 38мм. Литая латунная пряжка. Классика, которая прослужит десятилетия.',
    images: ['https://images.unsplash.com/photo-1624222247344-550fb60583dc?auto=format&fit=crop&q=80&w=800'],
    category: 'accessories',
    features: ['Saffiano', 'Solid Brass']
  },
  // APPAREL
  {
    id: 'tr-01',
    name: 'ASH GREY ARMOR',
    price: 3900,
    description: 'Лонгслив. Плотность 230г/м². Усиленная горловина. Базовый слой для городских условий.',
    images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800'],
    category: 'longsleeve',
    features: ['100% Cotton', '230 GSM']
  },
  {
    id: 'tr-04',
    name: 'HEAVY BLACK OPS',
    price: 4200,
    description: 'Лонгслив. Плотность 260г/м². Полная светомаскировка. Эффект "Heavy Weight".',
    images: ['https://images.unsplash.com/photo-1503341455253-b2e72333dbdb?auto=format&fit=crop&q=80&w=800'],
    category: 'longsleeve',
    features: ['Heavy Cotton', '260 GSM']
  }
];

export const SIZES = ['M', 'L', 'XL', 'ONE SIZE'];