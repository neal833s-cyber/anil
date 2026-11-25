import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

dotenv.config();
await connectDB();

const categories = [
  { name: 'Electronics',      slug: 'electronics',      description: 'Smart devices, gadgets, and accessories',           icon: '💻', color: '#3B82F6' },
  { name: 'Fashion',          slug: 'fashion',          description: 'Apparel, accessories, and trending outfits',         icon: '👗', color: '#EC4899' },
  { name: 'Groceries',        slug: 'groceries',        description: 'Daily essentials, fresh foods, and beverages',       icon: '🛒', color: '#10B981' },
  { name: 'Mobile Phones',    slug: 'mobile-phones',    description: 'Latest smartphones and accessories',                 icon: '📱', color: '#8B5CF6' },
  { name: 'Home Appliances',  slug: 'home-appliances',  description: 'Kitchen, cleaning, and home comfort products',       icon: '🏠', color: '#F59E0B' },
  { name: 'Books',            slug: 'books',            description: 'Bestsellers, education, and local favorites',        icon: '📚', color: '#EF4444' },
  { name: 'Sports & Outdoors',slug: 'sports-outdoors',  description: 'Fitness, trekking, and outdoor gear',               icon: '⛰️', color: '#06B6D4' },
  { name: 'Beauty & Health',  slug: 'beauty-health',    description: 'Cosmetics, skincare, and wellness',                  icon: '💄', color: '#F97316' },
];

const users = [
  {
    name: 'Admin User',
    email: 'admin@merobazaar.com',
    password: 'Admin@123',
    role: 'admin',
    isVerified: true,
    avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=E63946&color=fff',
  },
  {
    name: 'Sita Kumari',
    email: 'buyer@merobazaar.com',
    password: 'Buyer@123',
    role: 'buyer',
    isVerified: true,
    avatar: 'https://ui-avatars.com/api/?name=Sita+Kumari&background=1D3557&color=fff',
  },
  {
    name: 'Ram Prasad Store',
    email: 'seller@merobazaar.com',
    password: 'Seller@123',
    role: 'seller',
    isVerified: true,
    avatar: 'https://ui-avatars.com/api/?name=Ram+Prasad&background=10B981&color=fff',
    store: {
      name: "Ram's Electronics Hub",
      description: 'Quality electronics at the best prices in Nepal',
      logo: 'https://ui-avatars.com/api/?name=Rams+Store&background=10B981&color=fff',
    },
  },
];

const seedDB = async () => {
  try {
    await User.deleteMany();
    await Category.deleteMany();
    await Product.deleteMany();
    console.log('🗑️  Cleared existing data...');

    const createdCategories = await Category.insertMany(categories);
    console.log(`✅ Seeded ${createdCategories.length} categories`);

    const hashedUsers = await Promise.all(
      users.map(async (u) => ({ ...u, password: await bcrypt.hash(u.password, 12) }))
    );
    const createdUsers = await User.insertMany(hashedUsers);
    console.log(`✅ Seeded ${createdUsers.length} users`);

    const seller = createdUsers.find((u) => u.role === 'seller');

    const cat = (slug) => createdCategories.find((c) => c.slug === slug)._id;

    const products = [
      // ── ELECTRONICS ──────────────────────────────────────────────
      {
        name: 'Premium Wireless Headphones',
        slug: 'premium-wireless-headphones',
        description: 'Noise-canceling wireless headphones with 40-hour battery life, premium drivers, and foldable design.',
        price: 14999, salePrice: 12999,
        category: cat('electronics'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/0/900/900', public_id: 'elec_1' }],
        stock: 32, isFeatured: true, ratings: 4.8, numReviews: 78, soldCount: 145,
        brand: 'SoundMax', tags: ['headphones', 'wireless', 'audio'],
        specifications: [{ key: 'Battery', value: '40 hrs' }, { key: 'Bluetooth', value: '5.0' }],
      },
      {
        name: 'Mechanical Gaming Keyboard',
        slug: 'mechanical-gaming-keyboard',
        description: 'RGB backlit mechanical keyboard with tactile switches, anti-ghosting, and durable aluminum frame.',
        price: 8999, salePrice: 7499,
        category: cat('electronics'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/2/900/900', public_id: 'elec_2' }],
        stock: 20, isFeatured: true, ratings: 4.7, numReviews: 55, soldCount: 98,
        brand: 'GameGear', tags: ['keyboard', 'gaming', 'RGB'],
        specifications: [{ key: 'Switch', value: 'Cherry MX Red' }, { key: 'Layout', value: 'TKL' }],
      },
      {
        name: '27" 4K IPS Monitor',
        slug: '27-inch-4k-ips-monitor',
        description: 'Crystal-clear 4K IPS display with 144Hz refresh rate, HDR400, and ultra-thin bezels for immersive viewing.',
        price: 39999, salePrice: 34999,
        category: cat('electronics'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/3/900/900', public_id: 'elec_3' }],
        stock: 10, isFeatured: true, ratings: 4.9, numReviews: 42, soldCount: 60,
        brand: 'ViewPro', tags: ['monitor', '4K', 'display'],
        specifications: [{ key: 'Resolution', value: '3840x2160' }, { key: 'Refresh', value: '144Hz' }],
      },
      {
        name: 'Portable Bluetooth Speaker',
        slug: 'portable-bluetooth-speaker',
        description: 'Waterproof IPX7 speaker with 360° surround sound, 20-hour playtime, and built-in power bank.',
        price: 6999, salePrice: 5499,
        category: cat('electronics'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/4/900/900', public_id: 'elec_4' }],
        stock: 45, isFeatured: false, ratings: 4.5, numReviews: 90, soldCount: 210,
        brand: 'SoundMax', tags: ['speaker', 'bluetooth', 'portable'],
      },
      {
        name: 'Laptop Stand Adjustable',
        slug: 'laptop-stand-adjustable',
        description: 'Ergonomic aluminum laptop stand with 6 height levels, foldable design, and universal compatibility.',
        price: 2499, salePrice: 1999,
        category: cat('electronics'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/5/900/900', public_id: 'elec_5' }],
        stock: 80, isFeatured: false, ratings: 4.4, numReviews: 33, soldCount: 175,
        brand: 'ErgoDesk', tags: ['laptop', 'stand', 'ergonomic'],
      },
      {
        name: 'Wireless Charging Pad 15W',
        slug: 'wireless-charging-pad-15w',
        description: 'Fast wireless charger compatible with all Qi devices. 15W max output with LED indicator and anti-slip base.',
        price: 1999, salePrice: 1499,
        category: cat('electronics'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/6/900/900', public_id: 'elec_6' }],
        stock: 60, isFeatured: false, ratings: 4.3, numReviews: 67, soldCount: 300,
        brand: 'ChargePro', tags: ['charger', 'wireless', 'fast charge'],
      },

      // ── MOBILE PHONES ─────────────────────────────────────────────
      {
        name: 'Pro Smartphone 5G',
        slug: 'pro-smartphone-5g',
        description: '5G smartphone with 200MP AI triple camera, 6.7" AMOLED display, 5000mAh battery, and 12GB RAM.',
        price: 49999, salePrice: 44999,
        category: cat('mobile-phones'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/160/900/900', public_id: 'mob_1' }],
        stock: 24, isFeatured: true, ratings: 4.9, numReviews: 120, soldCount: 88,
        brand: 'TechPrime', tags: ['smartphone', '5G', 'camera'],
        specifications: [{ key: 'RAM', value: '12GB' }, { key: 'Storage', value: '256GB' }, { key: 'Camera', value: '200MP' }],
      },
      {
        name: 'Budget 4G Smartphone',
        slug: 'budget-4g-smartphone',
        description: 'Reliable everyday smartphone with 6.5" HD+ display, 5000mAh battery, 4GB RAM, and 64GB storage.',
        price: 12999, salePrice: 10999,
        category: cat('mobile-phones'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/162/900/900', public_id: 'mob_2' }],
        stock: 50, isFeatured: false, ratings: 4.2, numReviews: 200, soldCount: 420,
        brand: 'ValueTech', tags: ['smartphone', 'budget', '4G'],
        specifications: [{ key: 'RAM', value: '4GB' }, { key: 'Battery', value: '5000mAh' }],
      },
      {
        name: 'Tempered Glass Screen Protector',
        slug: 'tempered-glass-screen-protector',
        description: 'Ultra-thin 0.3mm 9H hardness tempered glass with oleophobic coating. Universal fit for 6.1"–6.7" phones.',
        price: 499, salePrice: 299,
        category: cat('mobile-phones'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/164/900/900', public_id: 'mob_3' }],
        stock: 200, isFeatured: false, ratings: 4.1, numReviews: 310, soldCount: 850,
        brand: 'ShieldGuard', tags: ['screen protector', 'tempered glass', 'mobile'],
      },
      {
        name: 'Phone Case Leather Wallet',
        slug: 'phone-case-leather-wallet',
        description: 'Genuine leather flip wallet case with card slots, kickstand, and magnetic closure. Fits most flagship phones.',
        price: 1299, salePrice: 999,
        category: cat('mobile-phones'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/166/900/900', public_id: 'mob_4' }],
        stock: 75, isFeatured: false, ratings: 4.3, numReviews: 88, soldCount: 190,
        brand: 'LeatherCraft', tags: ['phone case', 'leather', 'wallet'],
      },

      // ── FASHION ────────────────────────────────────────────────────
      {
        name: 'Urban Denim Jacket',
        slug: 'urban-denim-jacket',
        description: 'Slim-fit denim jacket with premium cotton blend fabric and reinforced stitching. A wardrobe essential.',
        price: 6999, salePrice: 5999,
        category: cat('fashion'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/26/900/900', public_id: 'fash_1' }],
        stock: 18, isFeatured: true, ratings: 4.6, numReviews: 54, soldCount: 130,
        brand: 'UrbanWear', tags: ['jacket', 'denim', 'men'],
      },
      {
        name: 'Women\'s Floral Kurta',
        slug: 'womens-floral-kurta',
        description: 'Beautiful hand-block printed cotton kurta with vibrant floral patterns. Perfect for festivals and daily wear.',
        price: 2999, salePrice: 2499,
        category: cat('fashion'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/28/900/900', public_id: 'fash_2' }],
        stock: 35, isFeatured: true, ratings: 4.7, numReviews: 89, soldCount: 220,
        brand: 'NepaliCraft', tags: ['kurta', 'women', 'ethnic', 'cotton'],
      },
      {
        name: 'Men\'s Slim Chinos',
        slug: 'mens-slim-chinos',
        description: 'Stretch slim-fit chinos in neutral tones. Wrinkle-resistant fabric ideal for office and casual outings.',
        price: 3499, salePrice: 2799,
        category: cat('fashion'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/30/900/900', public_id: 'fash_3' }],
        stock: 28, isFeatured: false, ratings: 4.4, numReviews: 46, soldCount: 155,
        brand: 'UrbanWear', tags: ['chinos', 'men', 'trousers'],
      },
      {
        name: 'Sports Running Shoes',
        slug: 'sports-running-shoes',
        description: 'Lightweight mesh running shoes with responsive cushioning, breathable upper, and anti-slip rubber sole.',
        price: 5999, salePrice: 4999,
        category: cat('fashion'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/32/900/900', public_id: 'fash_4' }],
        stock: 40, isFeatured: true, ratings: 4.5, numReviews: 112, soldCount: 280,
        brand: 'StepFast', tags: ['shoes', 'running', 'sports'],
        specifications: [{ key: 'Material', value: 'Mesh + Rubber' }, { key: 'Sole', value: 'Anti-slip' }],
      },
      {
        name: 'Pashmina Shawl Handwoven',
        slug: 'pashmina-shawl-handwoven',
        description: 'Authentic handwoven Nepali pashmina shawl in rich heritage patterns. Soft, warm, and ethically sourced.',
        price: 4999, salePrice: 4199,
        category: cat('fashion'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/34/900/900', public_id: 'fash_5' }],
        stock: 22, isFeatured: true, ratings: 4.9, numReviews: 65, soldCount: 90,
        brand: 'NepaliCraft', tags: ['pashmina', 'shawl', 'handwoven', 'nepal'],
      },

      // ── GROCERIES ─────────────────────────────────────────────────
      {
        name: 'Organic Grocery Bundle',
        slug: 'organic-grocery-bundle',
        description: 'Curated organic essentials for healthy cooking — grains, pulses, spices, and cold-pressed oils.',
        price: 3999, salePrice: 3499,
        category: cat('groceries'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/292/900/900', public_id: 'groc_1' }],
        stock: 56, isFeatured: false, ratings: 4.7, numReviews: 32, soldCount: 200,
        brand: 'Organic Nepal', tags: ['organic', 'groceries', 'healthy'],
      },
      {
        name: 'Premium Himalayan Honey 500g',
        slug: 'premium-himalayan-honey-500g',
        description: 'Raw, unfiltered honey harvested from Himalayan wildflowers. Rich in antioxidants and natural enzymes.',
        price: 1299, salePrice: 1099,
        category: cat('groceries'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/431/900/900', public_id: 'groc_2' }],
        stock: 100, isFeatured: true, ratings: 4.8, numReviews: 145, soldCount: 380,
        brand: 'HimalayanHarvest', tags: ['honey', 'himalayan', 'organic', 'natural'],
      },
      {
        name: 'Basmati Rice 5kg Premium',
        slug: 'basmati-rice-5kg-premium',
        description: 'Aged long-grain basmati rice with natural aroma. Ideal for biryani, pilaf, and everyday cooking.',
        price: 1599, salePrice: 1399,
        category: cat('groceries'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/493/900/900', public_id: 'groc_3' }],
        stock: 120, isFeatured: false, ratings: 4.5, numReviews: 78, soldCount: 450,
        brand: 'GrainMaster', tags: ['rice', 'basmati', 'grocery'],
      },
      {
        name: 'Cold Pressed Mustard Oil 1L',
        slug: 'cold-pressed-mustard-oil-1l',
        description: 'Traditional cold-pressed mustard oil with authentic pungent flavor. No chemicals, 100% pure.',
        price: 699, salePrice: 599,
        category: cat('groceries'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/425/900/900', public_id: 'groc_4' }],
        stock: 90, isFeatured: false, ratings: 4.6, numReviews: 110, soldCount: 520,
        brand: 'Organic Nepal', tags: ['mustard oil', 'cold pressed', 'cooking oil'],
      },

      // ── HOME APPLIANCES ────────────────────────────────────────────
      {
        name: 'Smart Air Fryer 6L',
        slug: 'smart-air-fryer-6l',
        description: 'Cook healthy meals with 95% less oil. Smart digital controls with 12 preset cooking modes.',
        price: 11999, salePrice: 9999,
        category: cat('home-appliances'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/425/900/900', public_id: 'home_1' }],
        stock: 16, isFeatured: true, ratings: 4.5, numReviews: 40, soldCount: 95,
        brand: 'KitchenPro', tags: ['air fryer', 'kitchen', 'healthy cooking'],
        specifications: [{ key: 'Capacity', value: '6L' }, { key: 'Power', value: '1800W' }],
      },
      {
        name: 'Robot Vacuum Cleaner',
        slug: 'robot-vacuum-cleaner',
        description: 'Smart robotic vacuum with auto-mapping, 2500Pa suction, app control, and self-charging dock.',
        price: 24999, salePrice: 19999,
        category: cat('home-appliances'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/250/900/900', public_id: 'home_2' }],
        stock: 12, isFeatured: true, ratings: 4.7, numReviews: 58, soldCount: 70,
        brand: 'CleanBot', tags: ['vacuum', 'robot', 'smart home'],
        specifications: [{ key: 'Suction', value: '2500Pa' }, { key: 'Battery', value: '150 min' }],
      },
      {
        name: 'Instant Pot 7-in-1 Cooker',
        slug: 'instant-pot-7-in-1-cooker',
        description: 'Multi-use pressure cooker with 7 functions: pressure cook, slow cook, sauté, steam, warm, yogurt, and rice.',
        price: 15999, salePrice: 12999,
        category: cat('home-appliances'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/252/900/900', public_id: 'home_3' }],
        stock: 25, isFeatured: false, ratings: 4.8, numReviews: 95, soldCount: 160,
        brand: 'KitchenPro', tags: ['pressure cooker', 'instant pot', 'kitchen'],
        specifications: [{ key: 'Capacity', value: '6L' }, { key: 'Functions', value: '7-in-1' }],
      },
      {
        name: 'Tower Fan 3-Speed',
        slug: 'tower-fan-3-speed',
        description: 'Slim tower fan with 3-speed settings, 8-hour timer, remote control, and ultra-quiet motor.',
        price: 6499, salePrice: 5299,
        category: cat('home-appliances'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/254/900/900', public_id: 'home_4' }],
        stock: 30, isFeatured: false, ratings: 4.3, numReviews: 62, soldCount: 185,
        brand: 'CoolBreeze', tags: ['fan', 'tower fan', 'cooling'],
      },

      // ── BOOKS ─────────────────────────────────────────────────────
      {
        name: 'Nepali Heritage Novel',
        slug: 'nepali-heritage-novel',
        description: 'Award-winning story of modern Nepal through the eyes of ordinary people. A literary masterpiece.',
        price: 1999, salePrice: 1799,
        category: cat('books'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/24/900/900', public_id: 'book_1' }],
        stock: 40, isFeatured: true, ratings: 4.4, numReviews: 22, soldCount: 110,
        brand: 'Nepal Prakashan', tags: ['novel', 'nepali', 'fiction'],
      },
      {
        name: 'The Psychology of Money',
        slug: 'the-psychology-of-money',
        description: 'Timeless lessons on wealth, greed, and happiness. One of the most popular finance books worldwide.',
        price: 1599, salePrice: 1299,
        category: cat('books'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/48/900/900', public_id: 'book_2' }],
        stock: 55, isFeatured: true, ratings: 4.9, numReviews: 187, soldCount: 340,
        brand: 'International Books', tags: ['finance', 'self-help', 'money'],
      },
      {
        name: 'Atomic Habits',
        slug: 'atomic-habits',
        description: 'An easy and proven way to build good habits and break bad ones by James Clear. A #1 NYT bestseller.',
        price: 1699, salePrice: 1399,
        category: cat('books'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/50/900/900', public_id: 'book_3' }],
        stock: 60, isFeatured: true, ratings: 4.8, numReviews: 230, soldCount: 490,
        brand: 'International Books', tags: ['habits', 'self-help', 'productivity'],
      },
      {
        name: 'Class 12 Science Bundle',
        slug: 'class-12-science-bundle',
        description: 'Complete set of Class 12 science textbooks: Physics, Chemistry, Biology, and Mathematics (NEB curriculum).',
        price: 2499, salePrice: 1999,
        category: cat('books'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/52/900/900', public_id: 'book_4' }],
        stock: 35, isFeatured: false, ratings: 4.6, numReviews: 75, soldCount: 210,
        brand: 'Nepal Prakashan', tags: ['textbook', 'class 12', 'NEB', 'science'],
      },

      // ── SPORTS & OUTDOORS ──────────────────────────────────────────
      {
        name: 'Trekking Backpack 60L',
        slug: 'trekking-backpack-60l',
        description: 'Durable 60L trekking backpack with rain cover, ventilated back panel, hip belt, and multiple compartments.',
        price: 8999, salePrice: 7499,
        category: cat('sports-outdoors'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/200/900/900', public_id: 'sport_1' }],
        stock: 22, isFeatured: true, ratings: 4.7, numReviews: 68, soldCount: 145,
        brand: 'TrailMaster', tags: ['backpack', 'trekking', 'hiking', 'nepal'],
        specifications: [{ key: 'Capacity', value: '60L' }, { key: 'Material', value: 'Ripstop Nylon' }],
      },
      {
        name: 'Yoga Mat Non-Slip 6mm',
        slug: 'yoga-mat-non-slip-6mm',
        description: 'Eco-friendly TPE yoga mat with superior grip, 6mm cushioning, alignment lines, and carry strap.',
        price: 2999, salePrice: 2299,
        category: cat('sports-outdoors'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/202/900/900', public_id: 'sport_2' }],
        stock: 50, isFeatured: false, ratings: 4.5, numReviews: 99, soldCount: 280,
        brand: 'ZenFit', tags: ['yoga', 'mat', 'fitness', 'exercise'],
      },
      {
        name: 'Adjustable Dumbbell Set 20kg',
        slug: 'adjustable-dumbbell-set-20kg',
        description: 'Space-saving adjustable dumbbell set from 2–20kg. Quick-change plates with secure locking mechanism.',
        price: 12999, salePrice: 10999,
        category: cat('sports-outdoors'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/204/900/900', public_id: 'sport_3' }],
        stock: 15, isFeatured: true, ratings: 4.6, numReviews: 44, soldCount: 85,
        brand: 'PowerLift', tags: ['dumbbell', 'weights', 'gym', 'fitness'],
        specifications: [{ key: 'Weight Range', value: '2–20kg' }, { key: 'Material', value: 'Cast Iron' }],
      },

      // ── BEAUTY & HEALTH ────────────────────────────────────────────
      {
        name: 'Vitamin C Serum 30ml',
        slug: 'vitamin-c-serum-30ml',
        description: 'Brightening 20% Vitamin C serum with hyaluronic acid and niacinamide. Reduces dark spots and boosts glow.',
        price: 2499, salePrice: 1999,
        category: cat('beauty-health'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/300/900/900', public_id: 'beauty_1' }],
        stock: 65, isFeatured: true, ratings: 4.7, numReviews: 134, soldCount: 310,
        brand: 'GlowLab', tags: ['serum', 'vitamin C', 'skincare', 'brightening'],
      },
      {
        name: 'Himalayan Face Wash',
        slug: 'himalayan-face-wash',
        description: 'Gentle foaming face wash with Himalayan herbs — neem, turmeric, and rose. Suits all skin types.',
        price: 699, salePrice: 549,
        category: cat('beauty-health'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/302/900/900', public_id: 'beauty_2' }],
        stock: 90, isFeatured: false, ratings: 4.5, numReviews: 210, soldCount: 580,
        brand: 'HimalayanHarvest', tags: ['face wash', 'himalayan', 'skincare', 'herbal'],
      },
      {
        name: 'Multivitamin Daily Pack 60 Tabs',
        slug: 'multivitamin-daily-pack-60-tabs',
        description: 'Complete daily multivitamin with 23 essential vitamins and minerals including Zinc, D3, B12, and Omega-3.',
        price: 1899, salePrice: 1599,
        category: cat('beauty-health'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/304/900/900', public_id: 'beauty_3' }],
        stock: 75, isFeatured: true, ratings: 4.6, numReviews: 88, soldCount: 245,
        brand: 'VitaCore', tags: ['multivitamin', 'supplements', 'health', 'vitamins'],
      },
      {
        name: 'Electric Foot Massager',
        slug: 'electric-foot-massager',
        description: 'Shiatsu foot massager with deep kneading, heat therapy, and air compression. Relieves fatigue and pain.',
        price: 7999, salePrice: 6499,
        category: cat('beauty-health'), seller: seller._id,
        images: [{ url: 'https://picsum.photos/id/306/900/900', public_id: 'beauty_4' }],
        stock: 18, isFeatured: false, ratings: 4.4, numReviews: 56, soldCount: 100,
        brand: 'RelaxPro', tags: ['massager', 'foot', 'wellness', 'electric'],
      },
    ];

    const createdProducts = await Product.insertMany(products);
    console.log(`✅ Seeded ${createdProducts.length} products`);

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📧 Demo accounts:');
    console.log('  Admin:  admin@merobazaar.com  / Admin@123');
    console.log('  Buyer:  buyer@merobazaar.com  / Buyer@123');
    console.log('  Seller: seller@merobazaar.com / Seller@123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedDB();
