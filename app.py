import os
import re
import sqlite3
import hashlib
import secrets
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'database.db')

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(16)
app.config['DATABASE'] = DB_PATH
app.config['SESSION_COOKIE_SECURE'] = False


def get_db_conn():
    conn = sqlite3.connect(app.config['DATABASE'])
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


def parse_image_urls(raw_value) -> list[str]:
    if not raw_value:
        return []
    if isinstance(raw_value, (list, tuple)):
        values = [str(item).strip() for item in raw_value if str(item).strip()]
    else:
        values = [item.strip() for item in re.split(r'[\n,]+', str(raw_value)) if item.strip()]
    return values


def get_product_images(product) -> list[str]:
    if not product:
        return ['/static/images/placeholder.jpg']

    if 'image_urls' in product.keys():
        image_urls = parse_image_urls(product['image_urls'])
        if image_urls:
            return image_urls

    if 'image' in product.keys() and product['image']:
        return [product['image']]

    return ['/static/images/placeholder.jpg']


def init_db():
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.executescript('''
    CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'customer',
        joined_at TEXT
    );
    CREATE TABLE IF NOT EXISTS Categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT
    );
    CREATE TABLE IF NOT EXISTS Products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        sale_price REAL,
        image TEXT,
        image_urls TEXT DEFAULT '',
        category_id INTEGER,
        inventory INTEGER DEFAULT 0,
        featured INTEGER DEFAULT 0,
        rating REAL DEFAULT 4.5,
        reviews INTEGER DEFAULT 0,
        created_at TEXT,
        seller_id INTEGER DEFAULT 0,
        FOREIGN KEY(category_id) REFERENCES Categories(id)
    );
    CREATE TABLE IF NOT EXISTS Orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        total REAL,
        status TEXT,
        payment_method TEXT,
        created_at TEXT,
        tracking_code TEXT,
        address TEXT,
        FOREIGN KEY(user_id) REFERENCES Users(id)
    );
    CREATE TABLE IF NOT EXISTS OrderItems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        price REAL,
        FOREIGN KEY(order_id) REFERENCES Orders(id),
        FOREIGN KEY(product_id) REFERENCES Products(id)
    );
    CREATE TABLE IF NOT EXISTS Cart (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        FOREIGN KEY(user_id) REFERENCES Users(id),
        FOREIGN KEY(product_id) REFERENCES Products(id)
    );
    CREATE TABLE IF NOT EXISTS Wishlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_id INTEGER,
        FOREIGN KEY(user_id) REFERENCES Users(id),
        FOREIGN KEY(product_id) REFERENCES Products(id)
    );
    CREATE TABLE IF NOT EXISTS Reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_id INTEGER,
        rating INTEGER,
        comment TEXT,
        created_at TEXT,
        FOREIGN KEY(user_id) REFERENCES Users(id),
        FOREIGN KEY(product_id) REFERENCES Products(id)
    );
    CREATE TABLE IF NOT EXISTS Payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        method TEXT,
        status TEXT,
        amount REAL,
        paid_at TEXT,
        FOREIGN KEY(order_id) REFERENCES Orders(id)
    );
    CREATE TABLE IF NOT EXISTS Messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER,
        receiver_id INTEGER,
        message TEXT,
        created_at TEXT,
        read INTEGER DEFAULT 0
    );
    ''')
    conn.commit()
    conn.close()


def seed_db():
    conn = get_db_conn()
    cursor = conn.cursor()
    
    # Idempotent user seeding
    users_to_seed = [
        ('Admin User', 'admin@merobazaar.com', hash_password('Admin@123'), 'admin'),
        ('Sita Kumari', 'user@merobazaar.com', hash_password('User@123'), 'customer'),
        ('TechStore Nepal', 'seller@merobazaar.com', hash_password('Seller@123'), 'seller')
    ]
    for name, email, pw, role in users_to_seed:
        cursor.execute('SELECT id FROM Users WHERE email = ?', (email,))
        if not cursor.fetchone():
            cursor.execute('INSERT INTO Users (name, email, password, role, joined_at) VALUES (?, ?, ?, ?, ?)',
                           (name, email, pw, role, datetime.utcnow().isoformat()))
            
    conn.commit()
    
    # Get seller's id
    cursor.execute('SELECT id FROM Users WHERE email = ?', ('seller@merobazaar.com',))
    seller_id = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM Categories')
    if cursor.fetchone()[0] == 0:
        categories = [
            ('Electronics', 'Smart devices, gadgets, and computer accessories'),
            ('Fashion', 'Apparel, accessories, and trending outfits'),
            ('Groceries', 'Daily essentials, fresh foods, and beverages'),
            ('Mobile Phones', 'Latest smartphones, cases, and chargers'),
            ('Home Appliances', 'Kitchen, cleaning, and home comfort products'),
            ('Books', 'Bestsellers, education, and local favorites')
        ]
        cursor.executemany('INSERT OR IGNORE INTO Categories(name, description) VALUES (?, ?)', categories)
        conn.commit()

    cursor.execute('SELECT COUNT(*) FROM Products')
    if cursor.fetchone()[0] == 0:
        products = [
            ('Premium Wireless Headphones', 'Noise-canceling design with long battery life', 149.99, 129.99, 'https://images.unsplash.com/photo-1512499617640-c2f99912b97a?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1512499617640-c2f99912b97a?auto=format&fit=crop&w=900&q=80,https://images.unsplash.com/photo-1518444065439-e933c06ce9cd?auto=format&fit=crop&w=900&q=80', 1, 32, 1, 4.8, 78, seller_id),
            ('Urban Denim Jacket', 'Modern fit jacket for everyday style', 69.99, 59.99, 'https://images.unsplash.com/photo-1520975915576-7926c70cc04c?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1520975915576-7926c70cc04c?auto=format&fit=crop&w=900&q=80,https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80', 2, 18, 1, 4.6, 54, 1),
            ('Organic Grocery Pack', 'Curated essentials for healthy home cooking', 39.99, 34.99, 'https://images.unsplash.com/photo-1506806732259-39c2d0268443?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1506806732259-39c2d0268443?auto=format&fit=crop&w=900&q=80,https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80', 3, 56, 0, 4.7, 32, 1),
            ('Prime Smartphone', 'High-performance mobile with AI camera', 499.99, 449.99, 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80,https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=900&q=80', 4, 24, 1, 4.9, 120, seller_id),
            ('Smart Air Fryer', 'Healthy frying with smart temperature control', 119.99, 99.99, 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=900&q=80,https://images.unsplash.com/photo-1574267432553-4b4628081c31?auto=format&fit=crop&w=900&q=80', 5, 16, 0, 4.5, 40, 1),
            ('Nepali Bestseller Novel', 'A modern story from local voices', 19.99, 17.99, 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80,https://images.unsplash.com/photo-1495446815901-01c4e2f2c5b8?auto=format&fit=crop&w=900&q=80', 6, 40, 0, 4.4, 22, 1)
        ]

        cursor.executemany('''
            INSERT OR IGNORE INTO Products
            (title, description, price, sale_price, image, image_urls, category_id, inventory, featured, rating, reviews, created_at, seller_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', [(title, desc, price, sale, img, image_urls, cat_id, stock, featured, rating, reviews, datetime.utcnow().isoformat(), s_id)
              for title, desc, price, sale, img, image_urls, cat_id, stock, featured, rating, reviews, s_id in products])
        conn.commit()

    # Seed mock messages if Chat table empty
    cursor.execute('SELECT COUNT(*) FROM Messages')
    if cursor.fetchone()[0] == 0:
        cursor.execute('SELECT id FROM Users WHERE email = ?', ('user@merobazaar.com',))
        buyer_id = cursor.fetchone()[0]
        messages = [
            (seller_id, buyer_id, "Hello! How can I help you today?", "2026-08-09T08:30:00"),
            (buyer_id, seller_id, "Hi, is this product still available?", "2026-08-09T08:31:00"),
            (seller_id, buyer_id, "Yes, it is available in stock.", "2026-08-09T08:31:45"),
            (buyer_id, seller_id, "Great! What about delivery time?", "2026-08-09T08:32:10"),
            (seller_id, buyer_id, "Immediate 1-2 days. Outside Kathmandu: 2-4 days", "2026-08-09T08:32:45"),
            (buyer_id, seller_id, "Okay, thank you!", "2026-08-09T08:33:40")
        ]
        cursor.executemany('INSERT INTO Messages (sender_id, receiver_id, message, created_at) VALUES (?, ?, ?, ?)', messages)
        conn.commit()

    conn.close()


def ensure_db():
    if not os.path.exists(app.config['DATABASE']):
        init_db()

    conn = get_db_conn()
    cursor = conn.cursor()
    
    # Check for seller_id column in Products
    cursor.execute("PRAGMA table_info(Products)")
    columns = [row[1] for row in cursor.fetchall()]
    if 'seller_id' not in columns:
        cursor.execute("ALTER TABLE Products ADD COLUMN seller_id INTEGER DEFAULT 0")
        
    # Check for image_urls column in Products
    if 'image_urls' not in columns:
        cursor.execute("ALTER TABLE Products ADD COLUMN image_urls TEXT DEFAULT ''")
        
    # Create Messages table if not exists
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER,
        receiver_id INTEGER,
        message TEXT,
        created_at TEXT,
        read INTEGER DEFAULT 0
    );
    ''')

    # Create Advertisements table if not exists
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Advertisements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        media_url TEXT,
        video_url TEXT,
        ad_type TEXT NOT NULL,
        seller_id INTEGER NOT NULL,
        product_id INTEGER,
        category_id INTEGER,
        destination_url TEXT,
        cta_text TEXT,
        start_date TEXT,
        end_date TEXT,
        status TEXT DEFAULT 'DRAFT',
        priority INTEGER DEFAULT 0,
        placement TEXT NOT NULL,
        budget REAL DEFAULT 0.0,
        price REAL DEFAULT 0.0,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY(seller_id) REFERENCES Users(id),
        FOREIGN KEY(product_id) REFERENCES Products(id),
        FOREIGN KEY(category_id) REFERENCES Categories(id)
    );
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_ads_status ON Advertisements(status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_ads_placement ON Advertisements(placement)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_ads_dates ON Advertisements(start_date, end_date)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_ads_seller ON Advertisements(seller_id)')
    
    cursor.execute("UPDATE Products SET image_urls = CASE WHEN COALESCE(image_urls, '') = '' THEN COALESCE(image, '') ELSE image_urls END")
    conn.commit()
    conn.close()
    seed_db()


@app.before_request
def before_request():
    ensure_db()
    # Auto-expire ads whose end date has passed and auto-activate approved ads whose start date has arrived
    try:
        conn = get_db_conn()
        today = datetime.utcnow().strftime('%Y-%m-%d')
        conn.execute("UPDATE Advertisements SET status = 'EXPIRED' WHERE status IN ('APPROVED', 'ACTIVE') AND date(end_date) < date(?)", (today,))
        conn.execute("UPDATE Advertisements SET status = 'ACTIVE' WHERE status = 'APPROVED' AND date(start_date) <= date(?) AND date(end_date) >= date(?)", (today, today))
        conn.commit()
        conn.close()
    except Exception as e:
        print("Error auto-updating ad campaigns:", e)


def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    conn = get_db_conn()
    user = conn.execute('SELECT * FROM Users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    return user


def get_cart_count(user_id):
    conn = get_db_conn()
    count = conn.execute('SELECT SUM(quantity) AS total FROM Cart WHERE user_id = ?', (user_id,)).fetchone()['total']
    conn.close()
    return int(count or 0)


def get_wishlist_count(user_id):
    conn = get_db_conn()
    count = conn.execute('SELECT COUNT(*) AS total FROM Wishlist WHERE user_id = ?', (user_id,)).fetchone()['total']
    conn.close()
    return int(count or 0)


def get_categories():
    conn = get_db_conn()
    categories = conn.execute('SELECT * FROM Categories ORDER BY name').fetchall()
    conn.close()
    return categories


def get_featured_products():
    conn = get_db_conn()
    products = conn.execute('SELECT * FROM Products WHERE featured = 1 ORDER BY created_at DESC LIMIT 6').fetchall()
    conn.close()
    return products


@app.route('/')
def home():
    user = get_current_user()
    categories = get_categories()
    featured = get_featured_products()
    conn = get_db_conn()
    top_sellers = conn.execute('SELECT * FROM Products ORDER BY reviews DESC, rating DESC LIMIT 4').fetchall()
    new_arrivals = conn.execute('SELECT * FROM Products ORDER BY created_at DESC LIMIT 4').fetchall()
    conn.close()
    return render_template('index.html', user=user, categories=categories, featured=featured, top_sellers=top_sellers, new_arrivals=new_arrivals)


@app.route('/products')
def products():
    user = get_current_user()
    category_id = request.args.get('category', type=int)
    search_query = request.args.get('q', '', type=str)
    conn = get_db_conn()
    sql = 'SELECT P.*, C.name AS category_name FROM Products P LEFT JOIN Categories C ON P.category_id = C.id WHERE 1=1'
    params = []
    if category_id:
        sql += ' AND category_id = ?'
        params.append(category_id)
    if search_query:
        sql += ' AND (P.title LIKE ? OR P.description LIKE ? OR C.name LIKE ?)'
        params.extend(['%' + search_query + '%'] * 3)
    products = conn.execute(sql + ' ORDER BY P.featured DESC, P.created_at DESC', tuple(params)).fetchall()
    categories = conn.execute('SELECT * FROM Categories ORDER BY name').fetchall()
    conn.close()
    return render_template('products.html', user=user, products=products, categories=categories, selected_category=category_id, search_query=search_query)


@app.route('/categories')
def categories():
    user = get_current_user()
    categories = get_categories()
    return render_template('categories.html', user=user, categories=categories)


@app.route('/product/<int:product_id>')
def product_detail(product_id):
    user = get_current_user()
    conn = get_db_conn()
    product = conn.execute('SELECT P.*, C.name AS category_name FROM Products P LEFT JOIN Categories C ON P.category_id = C.id WHERE P.id = ?', (product_id,)).fetchone()
    suggestions = conn.execute('SELECT * FROM Products WHERE category_id = ? AND id != ? LIMIT 4', (product['category_id'], product_id)).fetchall() if product else []
    reviews = conn.execute('SELECT R.*, U.name AS user_name FROM Reviews R JOIN Users U ON R.user_id = U.id WHERE R.product_id = ? ORDER BY created_at DESC LIMIT 6', (product_id,)).fetchall()
    conn.close()
    if not product:
        return redirect(url_for('products'))
    product_images = get_product_images(product)
    return render_template('product_detail.html', user=user, product=product, product_images=product_images, suggestions=suggestions, reviews=reviews)


@app.route('/cart')
def cart():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    conn = get_db_conn()
    items = conn.execute('''
        SELECT C.id AS cart_id, P.*, C.quantity FROM Cart C
        JOIN Products P ON P.id = C.product_id
        WHERE C.user_id = ?
    ''', (user['id'],)).fetchall()
    conn.close()
    subtotal = sum(item['price'] * item['quantity'] for item in items)
    return render_template('cart.html', user=user, items=items, subtotal=subtotal)


@app.route('/wishlist')
def wishlist():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    conn = get_db_conn()
    items = conn.execute('''
        SELECT W.id AS wishlist_id, P.* FROM Wishlist W
        JOIN Products P ON P.id = W.product_id
        WHERE W.user_id = ?
    ''', (user['id'],)).fetchall()
    conn.close()
    return render_template('wishlist.html', user=user, items=items)


@app.route('/checkout', methods=['GET', 'POST'])
def checkout():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    conn = get_db_conn()
    items = conn.execute('''
        SELECT C.product_id, P.title, P.price, C.quantity FROM Cart C
        JOIN Products P ON P.id = C.product_id
        WHERE C.user_id = ?
    ''', (user['id'],)).fetchall()
    if not items:
        conn.close()
        return redirect(url_for('cart'))
    subtotal = sum(item['price'] * item['quantity'] for item in items)
    shipping = 9.99
    total = subtotal + shipping
    categories = get_categories()
    if request.method == 'POST':
        payment_method = request.form.get('payment_method', 'Cash on Delivery')
        address = request.form.get('address', '').strip()
        if not address:
            flash('Please enter a valid shipping address.', 'danger')
            return render_template('checkout.html', user=user, items=items, subtotal=subtotal, shipping=shipping, total=total, categories=categories)
        conn.execute('INSERT INTO Orders (user_id, total, status, payment_method, created_at, tracking_code, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
                     (user['id'], total, 'Processing', payment_method, datetime.utcnow().isoformat(), 'MB-' + secrets.token_hex(4).upper(), address))
        order_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        for item in items:
            conn.execute('INSERT INTO OrderItems (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                         (order_id, item['product_id'], item['quantity'], item['price']))
            conn.execute('UPDATE Products SET inventory = inventory - ? WHERE id = ?', (item['quantity'], item['product_id']))
        conn.execute('DELETE FROM Cart WHERE user_id = ?', (user['id'],))
        conn.execute('INSERT INTO Payments (order_id, method, status, amount, paid_at) VALUES (?, ?, ?, ?, ?)',
                     (order_id, payment_method, 'Pending', total, datetime.utcnow().isoformat()))
        conn.commit()
        conn.close()
        flash('Order placed successfully! Your order is being processed.', 'success')
        return redirect(url_for('order_history'))
    conn.close()
    return render_template('checkout.html', user=user, items=items, subtotal=subtotal, shipping=shipping, total=total, categories=categories)


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        conn = get_db_conn()
        user = conn.execute('SELECT * FROM Users WHERE email = ?', (email,)).fetchone()
        conn.close()
        if user and user['password'] == hash_password(password):
            session['user_id'] = user['id']
            flash('Welcome back, ' + user['name'] + '!', 'success')
            if user['role'] == 'admin':
                return redirect(url_for('admin'))
            return redirect(url_for('profile'))
        flash('Invalid email or password.', 'danger')
    return render_template('login.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        if not name or not email or not password:
            flash('Please fill out all fields.', 'danger')
            return render_template('register.html')
        conn = get_db_conn()
        existing = conn.execute('SELECT id FROM Users WHERE email = ?', (email,)).fetchone()
        if existing:
            flash('This email is already registered.', 'danger')
            conn.close()
            return render_template('register.html')
        conn.execute('INSERT INTO Users (name, email, password, role, joined_at) VALUES (?, ?, ?, ?, ?)',
                     (name, email, hash_password(password), 'customer', datetime.utcnow().isoformat()))
        conn.commit()
        conn.close()
        flash('Account created successfully. Please log in.', 'success')
        return redirect(url_for('login'))
    return render_template('register.html')


@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('home'))


@app.route('/profile')
def profile():
    return redirect(url_for('dashboard'))


@app.route('/order-history')
def order_history():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    conn = get_db_conn()
    orders = conn.execute('SELECT * FROM Orders WHERE user_id = ? ORDER BY created_at DESC', (user['id'],)).fetchall()
    conn.close()
    return render_template('order_history.html', user=user, orders=orders)


@app.route('/order-tracking/<tracking_code>')
def order_tracking(tracking_code):
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    conn = get_db_conn()
    order = conn.execute('SELECT * FROM Orders WHERE tracking_code = ? AND user_id = ?', (tracking_code, user['id'])).fetchone()
    conn.close()
    if not order:
        flash('Tracking code not found.', 'danger')
        return redirect(url_for('order_history'))
    return render_template('order_tracking.html', user=user, order=order)


@app.route('/contact')
def contact():
    user = get_current_user()
    return render_template('contact.html', user=user)


@app.route('/about')
def about():
    user = get_current_user()
    return render_template('about.html', user=user)



@app.route('/dashboard')
def dashboard():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    if user['role'] == 'admin':
        return redirect(url_for('admin'))
    elif user['role'] == 'seller':
        return redirect(url_for('seller_dashboard'))
    else:
        return redirect(url_for('buyer_dashboard'))


@app.route('/buyer/dashboard')
def buyer_dashboard():
    user = get_current_user()
    if not user or user['role'] != 'customer':
        return redirect(url_for('login'))
    conn = get_db_conn()
    orders_count = conn.execute('SELECT COUNT(*) FROM Orders WHERE user_id = ?', (user['id'],)).fetchone()[0]
    wishlist_count = conn.execute('SELECT COUNT(*) FROM Wishlist WHERE user_id = ?', (user['id'],)).fetchone()[0]
    addresses_count = conn.execute('SELECT COUNT(DISTINCT address) FROM Orders WHERE user_id = ?', (user['id'],)).fetchone()[0]
    wallet_balance = 2450.00
    
    recent_orders = conn.execute('SELECT * FROM Orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', (user['id'],)).fetchall()
    wishlist_items = conn.execute('''
        SELECT W.id as wishlist_id, P.* 
        FROM Wishlist W 
        JOIN Products P ON W.product_id = P.id 
        WHERE W.user_id = ? LIMIT 5
    ''', (user['id'],)).fetchall()
    recommended_products = conn.execute('SELECT * FROM Products ORDER BY rating DESC LIMIT 4').fetchall()
    
    # Active chats with sellers
    sellers = conn.execute("SELECT id, name, email FROM Users WHERE role = 'seller'").fetchall()
    
    conn.close()
    return render_template('buyer_dashboard.html', user=user, orders_count=orders_count, wishlist_count=wishlist_count, addresses_count=addresses_count, wallet_balance=wallet_balance, recent_orders=recent_orders, wishlist_items=wishlist_items, recommended_products=recommended_products, sellers=sellers)


@app.route('/seller/dashboard', methods=['GET', 'POST'])
def seller_dashboard():
    user = get_current_user()
    if not user or user['role'] != 'seller':
        return redirect(url_for('login'))
        
    conn = get_db_conn()
    
    sales_stat = conn.execute('''
        SELECT SUM(OI.price * OI.quantity) as total_sales, COUNT(DISTINCT OI.order_id) as total_orders
        FROM OrderItems OI
        JOIN Products P ON OI.product_id = P.id
        WHERE P.seller_id = ?
    ''', (user['id'],)).fetchone()
    
    total_sales = sales_stat['total_sales'] or 0.0
    total_orders = sales_stat['total_orders'] or 0
    total_products = conn.execute('SELECT COUNT(*) FROM Products WHERE seller_id = ?', (user['id'],)).fetchone()[0]
    store_views = 12450
    
    recent_orders = conn.execute('''
        SELECT O.id, U.name as buyer_name, SUM(OI.price * OI.quantity) as total, O.status, O.created_at
        FROM OrderItems OI
        JOIN Orders O ON OI.order_id = O.id
        JOIN Users U ON O.user_id = U.id
        JOIN Products P ON OI.product_id = P.id
        WHERE P.seller_id = ?
        GROUP BY O.id
        ORDER BY O.created_at DESC
        LIMIT 5
    ''', (user['id'],)).fetchall()
    
    products = conn.execute('SELECT P.*, C.name as category_name FROM Products P LEFT JOIN Categories C ON P.category_id = C.id WHERE P.seller_id = ? ORDER BY P.created_at DESC', (user['id'],)).fetchall()
    categories = conn.execute('SELECT * FROM Categories ORDER BY name').fetchall()
    
    # Active chats with buyers
    buyers = conn.execute('''
        SELECT DISTINCT U.id, U.name, U.email
        FROM Users U
        JOIN Messages M ON (U.id = M.sender_id OR U.id = M.receiver_id)
        WHERE (M.sender_id = ? OR M.receiver_id = ?) AND U.id != ?
    ''', (user['id'], user['id'], user['id'])).fetchall()
    
    if not buyers:
        buyers = conn.execute("SELECT id, name, email FROM Users WHERE role = 'customer'").fetchall()
        
    if request.method == 'POST':
        action = request.form.get('action')
        if action == 'add_product':
            title = request.form.get('prod_title', '').strip()
            desc = request.form.get('prod_description', '').strip()
            price = float(request.form.get('prod_price', 0))
            sale_price = float(request.form.get('prod_sale_price', price))
            image = request.form.get('prod_image', '/static/images/placeholder.jpg').strip()
            image_urls = ','.join(parse_image_urls(image))
            if not image_urls:
                image_urls = '/static/images/placeholder.jpg'
            category_id = int(request.form.get('prod_category', 1))
            inventory = int(request.form.get('prod_inventory', 0))
            featured = 1 if request.form.get('prod_featured') == 'on' else 0
            rating = float(request.form.get('prod_rating', 4.5))
            reviews = int(request.form.get('prod_reviews', 0))
            
            conn.execute('''
                INSERT INTO Products (title, description, price, sale_price, image, image_urls, category_id, inventory, featured, rating, reviews, created_at, seller_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (title, desc, price, sale_price, image_urls.split(',')[0], image_urls, category_id, inventory, featured, rating, reviews, datetime.utcnow().isoformat(), user['id']))
            conn.commit()
            flash('Product added to your store successfully.', 'success')
            conn.close()
            return redirect(url_for('seller_dashboard'))
            
        elif action == 'update_stock':
            prod_id = int(request.form.get('stock_product_id'))
            stock = int(request.form.get('stock_quantity', 0))
            conn.execute('UPDATE Products SET inventory = ? WHERE id = ? AND seller_id = ?', (stock, prod_id, user['id']))
            conn.commit()
            flash('Stock updated successfully.', 'success')
            conn.close()
            return redirect(url_for('seller_dashboard'))
            
    conn.close()
    return render_template('seller_dashboard.html', user=user, total_sales=total_sales, total_orders=total_orders, total_products=total_products, store_views=store_views, recent_orders=recent_orders, products=products, categories=categories, buyers=buyers)


@app.route('/admin', methods=['GET', 'POST'])
def admin():
    user = get_current_user()
    if not user or user['role'] != 'admin':
        flash('Admin access required.', 'danger')
        return redirect(url_for('login'))
    conn = get_db_conn()
    products = conn.execute('SELECT P.*, C.name AS category_name FROM Products P LEFT JOIN Categories C ON P.category_id = C.id ORDER BY P.created_at DESC').fetchall()
    categories = conn.execute('SELECT * FROM Categories ORDER BY name').fetchall()
    orders = conn.execute('SELECT O.*, U.name AS buyer_name FROM Orders O LEFT JOIN Users U ON O.user_id = U.id ORDER BY O.created_at DESC LIMIT 8').fetchall()
    users = conn.execute('SELECT * FROM Users ORDER BY joined_at DESC LIMIT 8').fetchall()
    sales = conn.execute('SELECT SUM(total) AS total_sales, COUNT(*) AS orders_count FROM Orders').fetchone()
    
    total_users = conn.execute("SELECT COUNT(*) FROM Users WHERE role = 'customer'").fetchone()[0]
    total_sellers = conn.execute("SELECT COUNT(*) FROM Users WHERE role = 'seller'").fetchone()[0]
    total_products = conn.execute("SELECT COUNT(*) FROM Products").fetchone()[0]
    total_orders = conn.execute("SELECT COUNT(*) FROM Orders").fetchone()[0]
    sellers = conn.execute("SELECT * FROM Users WHERE role = 'seller' ORDER BY joined_at DESC LIMIT 8").fetchall()
    
    if request.method == 'POST':
        action = request.form.get('action')
        if action == 'add_category':
            name = request.form.get('cat_name', '').strip()
            description = request.form.get('cat_description', '').strip()
            if name:
                conn.execute('INSERT OR IGNORE INTO Categories (name, description) VALUES (?, ?)', (name, description))
                conn.commit()
                flash('Category added successfully.', 'success')
        if action == 'add_product':
            title = request.form.get('prod_title', '').strip()
            desc = request.form.get('prod_description', '').strip()
            price = float(request.form.get('prod_price', 0))
            sale_price = float(request.form.get('prod_sale_price', price))
            image = request.form.get('prod_image', '/static/images/placeholder.jpg').strip()
            image_urls = ','.join(parse_image_urls(image))
            if not image_urls:
                image_urls = '/static/images/placeholder.jpg'
            category_id = int(request.form.get('prod_category', 1))
            inventory = int(request.form.get('prod_inventory', 0))
            featured = 1 if request.form.get('prod_featured') == 'on' else 0
            rating = float(request.form.get('prod_rating', 4.5))
            reviews = int(request.form.get('prod_reviews', 0))
            conn.execute('INSERT INTO Products (title, description, price, sale_price, image, image_urls, category_id, inventory, featured, rating, reviews, created_at, seller_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                         (title, desc, price, sale_price, image_urls.split(',')[0], image_urls, category_id, inventory, featured, rating, reviews, datetime.utcnow().isoformat(), 1))
            conn.commit()
            flash('Product added successfully.', 'success')
        if action == 'update_stock':
            prod_id = int(request.form.get('stock_product_id'))
            stock = int(request.form.get('stock_quantity', 0))
            conn.execute('UPDATE Products SET inventory = ? WHERE id = ?', (stock, prod_id))
            conn.commit()
            flash('Product stock updated.', 'success')
        return redirect(url_for('admin'))
    conn.close()
    return render_template('admin.html', user=user, products=products, categories=categories, orders=orders, users=users, sellers=sellers, sales=sales, total_users=total_users, total_sellers=total_sellers, total_products=total_products, total_orders=total_orders)


# -------------------------------------------------------------
# ADVERTISING SYSTEM APIS & ROUTING
# -------------------------------------------------------------

UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/upload', methods=['POST'])
def api_upload():
    user = get_current_user()
    if not user or user['role'] not in ('seller', 'admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'}), 400
        
    if not allowed_file(file.filename):
        return jsonify({'success': False, 'message': 'Invalid file type. Supported types: JPG, PNG, WEBP, GIF, MP4, WEBM'}), 400
        
    content_length = request.content_length
    if content_length and content_length > 10 * 1024 * 1024:
        return jsonify({'success': False, 'message': 'File size exceeds 10MB limit'}), 400

    filename = secrets.token_hex(8) + os.path.splitext(file.filename)[1].lower()
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    
    return jsonify({
        'success': True,
        'url': f'/static/uploads/{filename}'
    })

@app.route('/api/ads', methods=['GET'])
def api_get_active_ads():
    placement = request.args.get('placement')
    conn = get_db_conn()
    today = datetime.utcnow().strftime('%Y-%m-%d')
    query = '''
        SELECT A.*, U.name as seller_name, P.title as product_name, C.name as category_name 
        FROM Advertisements A
        LEFT JOIN Users U ON A.seller_id = U.id
        LEFT JOIN Products P ON A.product_id = P.id
        LEFT JOIN Categories C ON A.category_id = C.id
        WHERE A.status = 'ACTIVE' 
        AND date(A.start_date) <= date(?) 
        AND date(A.end_date) >= date(?)
    '''
    params = [today, today]
    if placement:
        query += ' AND A.placement = ?'
        params.append(placement)
    query += ' ORDER BY A.priority DESC, A.created_at DESC'
    ads = conn.execute(query, tuple(params)).fetchall()
    conn.close()
    return jsonify([dict(ad) for ad in ads])

@app.route('/api/ads/<int:ad_id>/impression', methods=['POST'])
def api_record_impression(ad_id):
    conn = get_db_conn()
    ad = conn.execute('SELECT id FROM Advertisements WHERE id = ?', (ad_id,)).fetchone()
    if not ad:
        conn.close()
        return jsonify({'success': False, 'message': 'Ad not found'}), 404
    conn.execute('UPDATE Advertisements SET impressions = impressions + 1 WHERE id = ?', (ad_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/ads/<int:ad_id>/click', methods=['POST'])
def api_record_click(ad_id):
    conn = get_db_conn()
    ad = conn.execute('SELECT id FROM Advertisements WHERE id = ?', (ad_id,)).fetchone()
    if not ad:
        conn.close()
        return jsonify({'success': False, 'message': 'Ad not found'}), 404
    conn.execute('UPDATE Advertisements SET clicks = clicks + 1 WHERE id = ?', (ad_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/ad/click/<int:ad_id>')
def ad_click_gateway(ad_id):
    conn = get_db_conn()
    ad = conn.execute('SELECT * FROM Advertisements WHERE id = ?', (ad_id,)).fetchone()
    if not ad:
        conn.close()
        return redirect(url_for('home'))
        
    conn.execute('UPDATE Advertisements SET clicks = clicks + 1 WHERE id = ?', (ad_id,))
    conn.commit()
    conn.close()
    
    if ad['ad_type'] == 'product' and ad['product_id']:
        return redirect(url_for('product_detail', product_id=ad['product_id']))
    elif ad['ad_type'] == 'category' and ad['category_id']:
        return redirect(f"{url_for('products')}?category={ad['category_id']}")
    elif ad['destination_url']:
        dest = ad['destination_url']
        if dest.startswith(('http://', 'https://')):
            return redirect(dest)
        return redirect(dest)
    return redirect(url_for('home'))

@app.route('/api/ads/seller/my-ads', methods=['GET'])
def api_seller_get_ads():
    user = get_current_user()
    if not user or user['role'] != 'seller':
        return jsonify({'success': False, 'message': 'Seller access required'}), 401
    conn = get_db_conn()
    ads = conn.execute('''
        SELECT A.*, P.title as product_name, C.name as category_name 
        FROM Advertisements A
        LEFT JOIN Products P ON A.product_id = P.id
        LEFT JOIN Categories C ON A.category_id = C.id
        WHERE A.seller_id = ? AND A.status != 'DELETED'
        ORDER BY A.created_at DESC
    ''', (user['id'],)).fetchall()
    conn.close()
    return jsonify([dict(ad) for ad in ads])

@app.route('/api/ads/seller/analytics', methods=['GET'])
def api_seller_get_analytics():
    user = get_current_user()
    if not user or user['role'] != 'seller':
        return jsonify({'success': False, 'message': 'Seller access required'}), 401
    conn = get_db_conn()
    stats = conn.execute('''
        SELECT 
            COUNT(id) as total_campaigns,
            SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_campaigns,
            SUM(impressions) as total_impressions,
            SUM(clicks) as total_clicks
        FROM Advertisements
        WHERE seller_id = ? AND status != 'DELETED'
    ''', (user['id'],)).fetchone()
    
    top_ads = conn.execute('''
        SELECT id, title, impressions, clicks, status, ad_type, placement,
               CASE WHEN impressions > 0 THEN (CAST(clicks AS REAL)/impressions)*100 ELSE 0.0 END as ctr
        FROM Advertisements
        WHERE seller_id = ? AND status != 'DELETED'
        ORDER BY clicks DESC LIMIT 5
    ''', (user['id'],)).fetchall()
    
    total_imp = stats['total_impressions'] or 0
    total_clk = stats['total_clicks'] or 0
    
    labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    daily_impressions = [int(total_imp * w) for w in [0.1, 0.15, 0.12, 0.2, 0.18, 0.13, 0.12]]
    daily_clicks = [int(total_clk * w) for w in [0.08, 0.12, 0.15, 0.18, 0.22, 0.15, 0.1]]
    
    conn.close()
    return jsonify({
        'total_campaigns': stats['total_campaigns'] or 0,
        'active_campaigns': stats['active_campaigns'] or 0,
        'total_impressions': total_imp,
        'total_clicks': total_clk,
        'ctr': (total_clk / total_imp * 100) if total_imp > 0 else 0.0,
        'top_ads': [dict(ad) for ad in top_ads],
        'chart_labels': labels,
        'chart_impressions': daily_impressions,
        'chart_clicks': daily_clicks
    })

@app.route('/api/ads', methods=['POST'])
def api_create_ad():
    user = get_current_user()
    if not user or user['role'] != 'seller':
        return jsonify({'success': False, 'message': 'Seller access required'}), 401
    
    data = request.json or {}
    title = data.get('title', '').strip()
    ad_type = data.get('ad_type', '').strip()
    placement = data.get('placement', '').strip()
    start_date = data.get('start_date', '').strip()
    end_date = data.get('end_date', '').strip()
    
    if not (title and ad_type and placement and start_date and end_date):
        return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
    product_id = data.get('product_id')
    if product_id:
        product_id = int(product_id)
        conn = get_db_conn()
        prod = conn.execute('SELECT seller_id FROM Products WHERE id = ?', (product_id,)).fetchone()
        conn.close()
        if not prod or prod['seller_id'] != user['id']:
            return jsonify({'success': False, 'message': 'Invalid product selection. You do not own this product.'}), 403
            
    budget = float(data.get('budget', 0.0))
    price = float(data.get('price', 0.0))
    
    conn = get_db_conn()
    conn.execute('''
        INSERT INTO Advertisements (
            title, description, media_url, video_url, ad_type, seller_id, 
            product_id, category_id, destination_url, cta_text, start_date, 
            end_date, status, priority, placement, budget, price, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        title, data.get('description'), data.get('media_url'), data.get('video_url'), ad_type, user['id'],
        product_id, data.get('category_id'), data.get('destination_url'), data.get('cta_text', 'Shop Now'),
        start_date, end_date, data.get('status', 'DRAFT'), int(data.get('priority', 0)),
        placement, budget, price, datetime.utcnow().isoformat(), datetime.utcnow().isoformat()
    ))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Advertisement created successfully'})

@app.route('/api/ads/<int:ad_id>', methods=['PUT'])
def api_edit_ad(ad_id):
    user = get_current_user()
    if not user or user['role'] != 'seller':
        return jsonify({'success': False, 'message': 'Seller access required'}), 401
        
    conn = get_db_conn()
    ad = conn.execute('SELECT * FROM Advertisements WHERE id = ?', (ad_id,)).fetchone()
    if not ad:
        conn.close()
        return jsonify({'success': False, 'message': 'Advertisement not found'}), 404
        
    if ad['seller_id'] != user['id']:
        conn.close()
        return jsonify({'success': False, 'message': 'Unauthorized to modify this advertisement'}), 403
        
    data = request.json or {}
    
    product_id = data.get('product_id')
    if product_id:
        product_id = int(product_id)
        prod = conn.execute('SELECT seller_id FROM Products WHERE id = ?', (product_id,)).fetchone()
        if not prod or prod['seller_id'] != user['id']:
            conn.close()
            return jsonify({'success': False, 'message': 'Invalid product selection. You do not own this product.'}), 403

    conn.execute('''
        UPDATE Advertisements SET
            title = ?, description = ?, media_url = ?, video_url = ?, ad_type = ?, 
            product_id = ?, category_id = ?, destination_url = ?, cta_text = ?, 
            start_date = ?, end_date = ?, status = ?, priority = ?, placement = ?, 
            budget = ?, price = ?, updated_at = ?
        WHERE id = ?
    ''', (
        data.get('title', ad['title']), data.get('description', ad['description']), 
        data.get('media_url', ad['media_url']), data.get('video_url', ad['video_url']), 
        data.get('ad_type', ad['ad_type']), product_id or ad['product_id'], 
        data.get('category_id', ad['category_id']), data.get('destination_url', ad['destination_url']), 
        data.get('cta_text', ad['cta_text']), data.get('start_date', ad['start_date']), 
        data.get('end_date', ad['end_date']), data.get('status', ad['status']), 
        int(data.get('priority', ad['priority'])), data.get('placement', ad['placement']), 
        float(data.get('budget', ad['budget'])), float(data.get('price', ad['price'])), 
        datetime.utcnow().isoformat(), ad_id
    ))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Advertisement updated successfully'})

@app.route('/api/ads/admin/all', methods=['GET'])
def api_admin_get_all_ads():
    user = get_current_user()
    if not user or user['role'] != 'admin':
        return jsonify({'success': False, 'message': 'Admin access required'}), 401
        
    conn = get_db_conn()
    ads = conn.execute('''
        SELECT A.*, U.name as seller_name, U.email as seller_email, P.title as product_name, C.name as category_name 
        FROM Advertisements A
        LEFT JOIN Users U ON A.seller_id = U.id
        LEFT JOIN Products P ON A.product_id = P.id
        LEFT JOIN Categories C ON A.category_id = C.id
        WHERE A.status != 'DELETED'
        ORDER BY A.created_at DESC
    ''').fetchall()
    conn.close()
    return jsonify([dict(ad) for ad in ads])

@app.route('/api/ads/admin/analytics', methods=['GET'])
def api_admin_get_analytics():
    user = get_current_user()
    if not user or user['role'] != 'admin':
        return jsonify({'success': False, 'message': 'Admin access required'}), 401
        
    conn = get_db_conn()
    stats = conn.execute('''
        SELECT 
            COUNT(id) as total_ads,
            SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_ads,
            SUM(CASE WHEN status = 'PENDING_APPROVAL' THEN 1 ELSE 0 END) as pending_approvals,
            SUM(impressions) as total_impressions,
            SUM(clicks) as total_clicks,
            SUM(price) as total_revenue
        FROM Advertisements
        WHERE status != 'DELETED'
    ''').fetchone()
    
    top_sellers = conn.execute('''
        SELECT U.name as seller_name, U.email as seller_email, COUNT(A.id) as total_ads, SUM(A.price) as ad_spend
        FROM Advertisements A
        JOIN Users U ON A.seller_id = U.id
        WHERE A.status != 'DELETED'
        GROUP BY A.seller_id
        ORDER BY total_ads DESC LIMIT 5
    ''').fetchall()
    
    top_ads = conn.execute('''
        SELECT A.id, A.title, U.name as seller_name, A.impressions, A.clicks, A.status, A.placement,
               CASE WHEN A.impressions > 0 THEN (CAST(A.clicks AS REAL)/A.impressions)*100 ELSE 0.0 END as ctr
        FROM Advertisements A
        JOIN Users U ON A.seller_id = U.id
        WHERE A.status != 'DELETED'
        ORDER BY A.clicks DESC LIMIT 5
    ''').fetchall()
    
    placement_breakdown = conn.execute('''
        SELECT placement, COUNT(id) as count, SUM(impressions) as impressions, SUM(clicks) as clicks
        FROM Advertisements
        WHERE status != 'DELETED'
        GROUP BY placement
    ''').fetchall()
    
    conn.close()
    return jsonify({
        'total_ads': stats['total_ads'] or 0,
        'active_ads': stats['active_ads'] or 0,
        'pending_approvals': stats['pending_approvals'] or 0,
        'total_impressions': stats['total_impressions'] or 0,
        'total_clicks': stats['total_clicks'] or 0,
        'total_revenue': stats['total_revenue'] or 0.0,
        'top_sellers': [dict(s) for s in top_sellers],
        'top_ads': [dict(a) for a in top_ads],
        'placements': [dict(p) for p in placement_breakdown]
    })

@app.route('/api/ads/admin/<int:ad_id>/approve', methods=['PUT'])
def api_admin_approve_ad(ad_id):
    user = get_current_user()
    if not user or user['role'] != 'admin':
        return jsonify({'success': False, 'message': 'Admin access required'}), 401
        
    conn = get_db_conn()
    ad = conn.execute('SELECT * FROM Advertisements WHERE id = ?', (ad_id,)).fetchone()
    if not ad:
        conn.close()
        return jsonify({'success': False, 'message': 'Advertisement not found'}), 404
        
    today = datetime.utcnow().strftime('%Y-%m-%d')
    status = 'ACTIVE' if ad['start_date'] <= today and ad['end_date'] >= today else 'APPROVED'
    
    conn.execute("UPDATE Advertisements SET status = ?, updated_at = ? WHERE id = ?", (status, datetime.utcnow().isoformat(), ad_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': f'Advertisement approved. Status set to {status}.'})

@app.route('/api/ads/admin/<int:ad_id>/reject', methods=['PUT'])
def api_admin_reject_ad(ad_id):
    user = get_current_user()
    if not user or user['role'] != 'admin':
        return jsonify({'success': False, 'message': 'Admin access required'}), 401
        
    conn = get_db_conn()
    ad = conn.execute('SELECT * FROM Advertisements WHERE id = ?', (ad_id,)).fetchone()
    if not ad:
        conn.close()
        return jsonify({'success': False, 'message': 'Advertisement not found'}), 404
        
    data = request.json or {}
    reason = data.get('reason', 'Rejected by administrator')
    
    conn.execute("UPDATE Advertisements SET status = 'REJECTED', description = description || '\n(Rejection Reason: ' || ? || ')', updated_at = ? WHERE id = ?", (reason, datetime.utcnow().isoformat(), ad_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Advertisement rejected'})

@app.route('/api/ads/admin/<int:ad_id>/status', methods=['PUT'])
def api_admin_set_status(ad_id):
    user = get_current_user()
    if not user or user['role'] != 'admin':
        return jsonify({'success': False, 'message': 'Admin access required'}), 401
        
    data = request.json or {}
    new_status = data.get('status')
    if new_status not in ('ACTIVE', 'PAUSED', 'APPROVED', 'REJECTED', 'EXPIRED'):
        return jsonify({'success': False, 'message': 'Invalid status'}), 400
        
    conn = get_db_conn()
    conn.execute("UPDATE Advertisements SET status = ?, updated_at = ? WHERE id = ?", (new_status, datetime.utcnow().isoformat(), ad_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Advertisement status updated'})

@app.route('/api/ads/admin/<int:ad_id>/priority', methods=['PUT'])
def api_admin_set_priority(ad_id):
    user = get_current_user()
    if not user or user['role'] != 'admin':
        return jsonify({'success': False, 'message': 'Admin access required'}), 401
        
    data = request.json or {}
    priority = int(data.get('priority', 0))
    
    conn = get_db_conn()
    conn.execute("UPDATE Advertisements SET priority = ?, updated_at = ? WHERE id = ?", (priority, datetime.utcnow().isoformat(), ad_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Advertisement priority updated'})


@app.route('/api/chat/history')
def api_chat_history():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Auth required'}), 401
    other_user_id = request.args.get('user_id', type=int)
    if not other_user_id:
        return jsonify({'success': False, 'message': 'user_id required'}), 400
    conn = get_db_conn()
    messages = conn.execute('''
        SELECT * FROM Messages 
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at ASC
    ''', (user['id'], other_user_id, other_user_id, user['id'])).fetchall()
    conn.close()
    return jsonify([dict(m) for m in messages])


@app.route('/api/chat/send', methods=['POST'])
def api_chat_send():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Auth required'}), 401
    data = request.json or {}
    receiver_id = data.get('receiver_id')
    message = data.get('message', '').strip()
    if not receiver_id or not message:
        return jsonify({'success': False, 'message': 'Missing data'}), 400
    conn = get_db_conn()
    conn.execute('INSERT INTO Messages (sender_id, receiver_id, message, created_at) VALUES (?, ?, ?, ?)',
                 (user['id'], receiver_id, message, datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/seller/stats')
def api_seller_stats():
    user = get_current_user()
    if not user or user['role'] != 'seller':
        return jsonify({'success': False}), 401
    data = {
        'labels': ['Apr 15', 'Apr 20', 'Apr 25', 'Apr 30', 'May 05', 'May 10', 'May 15'],
        'sales': [45000, 75000, 55000, 110000, 85000, 125000, 145230],
        'orders': [45, 95, 78, 140, 115, 185, 230]
    }
    return jsonify(data)


@app.route('/api/admin/stats')
def api_admin_stats():
    user = get_current_user()
    if not user or user['role'] != 'admin':
        return jsonify({'success': False}), 401
    conn = get_db_conn()
    categories = conn.execute('''
        SELECT C.name, COUNT(P.id) as count
        FROM Categories C
        LEFT JOIN Products P ON C.id = P.category_id
        GROUP BY C.id
    ''').fetchall()
    conn.close()
    
    data = {
        'revenue_labels': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        'revenue': [1200000, 1850000, 2400000, 3100000, 3950000, 4562890],
        'categories': [c['name'] for c in categories],
        'category_counts': [c['count'] for c in categories]
    }
    return jsonify(data)


@app.route('/api/search')
def api_search():
    query = request.args.get('q', '').strip()
    category_id = request.args.get('category', type=int)
    conn = get_db_conn()
    sql = 'SELECT * FROM Products WHERE 1=1'
    params = []
    if query:
        sql += ' AND (title LIKE ? OR description LIKE ?)'
        params.extend(['%' + query + '%'] * 2)
    if category_id:
        sql += ' AND category_id = ?'
        params.append(category_id)
    products = conn.execute(sql + ' ORDER BY featured DESC, created_at DESC', tuple(params)).fetchall()
    conn.close()
    return jsonify([dict(p) for p in products])


@app.route('/api/add_to_cart', methods=['POST'])
def api_add_to_cart():
    if not get_current_user():
        return jsonify({'success': False, 'message': 'Login required'}), 401
    data = request.json or {}
    product_id = data.get('product_id')
    quantity = int(data.get('quantity', 1))
    user = get_current_user()
    conn = get_db_conn()
    existing = conn.execute('SELECT * FROM Cart WHERE user_id = ? AND product_id = ?', (user['id'], product_id)).fetchone()
    if existing:
        conn.execute('UPDATE Cart SET quantity = quantity + ? WHERE id = ?', (quantity, existing['id']))
    else:
        conn.execute('INSERT INTO Cart (user_id, product_id, quantity) VALUES (?, ?, ?)', (user['id'], product_id, quantity))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'count': get_cart_count(user['id'])})


@app.route('/api/remove_from_cart', methods=['POST'])
def api_remove_from_cart():
    if not get_current_user():
        return jsonify({'success': False}), 401
    cart_id = request.json.get('cart_id')
    user = get_current_user()
    conn = get_db_conn()
    conn.execute('DELETE FROM Cart WHERE id = ? AND user_id = ?', (cart_id, user['id']))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'count': get_cart_count(user['id'])})


@app.route('/api/add_to_wishlist', methods=['POST'])
def api_add_to_wishlist():
    if not get_current_user():
        return jsonify({'success': False, 'message': 'Login required'}), 401
    data = request.json or {}
    product_id = data.get('product_id')
    user = get_current_user()
    conn = get_db_conn()
    existing = conn.execute('SELECT * FROM Wishlist WHERE user_id = ? AND product_id = ?', (user['id'], product_id)).fetchone()
    if not existing:
        conn.execute('INSERT INTO Wishlist (user_id, product_id) VALUES (?, ?)', (user['id'], product_id))
        conn.commit()
    conn.close()
    return jsonify({'success': True, 'count': get_wishlist_count(user['id'])})


@app.route('/api/remove_from_wishlist', methods=['POST'])
def api_remove_from_wishlist():
    if not get_current_user():
        return jsonify({'success': False}), 401
    wishlist_id = request.json.get('wishlist_id')
    user = get_current_user()
    conn = get_db_conn()
    conn.execute('DELETE FROM Wishlist WHERE id = ? AND user_id = ?', (wishlist_id, user['id']))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'count': get_wishlist_count(user['id'])})


@app.context_processor
def inject_global_values():
    user = get_current_user()
    cart_count = get_cart_count(user['id']) if user else 0
    wishlist_count = get_wishlist_count(user['id']) if user else 0
    return {'user': user, 'cart_count': cart_count, 'wishlist_count': wishlist_count, 'datetime': datetime}


if __name__ == '__main__':
    ensure_db()
    app.run(debug=True, port=5000)
