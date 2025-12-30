import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, Menu, X, Home, Heart, User, MessageCircle, Grid } from 'lucide-react';
import { useCart } from '../context/CartContext';
import './HomePage.css';
import BottomNav from '../components/BottomNav';

interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice: number | null;
  image: string;
  category_id: number;  // ← 改這裡
  rating: number;
  reviews: number;
  description: string;
}

// ← 新增這個介面
interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  level: number;
  is_active: number;
  productCount: number;
}

interface HeroBanner {
  id: number;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
}

interface CategoryProducts {
  category: Category;
  products: Product[];
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  // 狀態管理
  const { cartCount, addToCart } = useCart();
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [currentCategory, setCurrentCategory] = useState<number | 'all'>('all');  // ← 改這裡
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);  // ← 新增這行
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [isLineModalOpen, setIsLineModalOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [categoryProductsList, setCategoryProductsList] = useState<CategoryProducts[]>([]);

  useEffect(() => {
   fetchCategories();
    fetchProducts();
    fetchWishlist();
    fetchBanners();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('https://www.anxinshophub.com/api/categories');
      const data = await response.json();

      if (data.success) {
        setCategories(data.categories);
        
        // 取前4個分類的商品
        const top4Categories = data.categories.slice(0, 4);
        const categoryProductsData: CategoryProducts[] = [];

        for (const category of top4Categories) {
          try {
            const productRes = await fetch(`https://www.anxinshophub.com/api/products/category/${category.id}`);
            const productData = await productRes.json();
            
            if (productData.success) {
              categoryProductsData.push({
                category: category,
                products: productData.products.slice(0, 8).map((product: any) => ({
                  id: product.id,
                  name: product.name,
                  price: parseFloat(product.price),
                  originalPrice: null,
                  image: product.main_image || 'https://via.placeholder.com/400',
                  category_id: product.category_id,
                  rating: 4.5,
                  reviews: 0,
                  description: product.description || '暫無描述'
                }))
              });
            }
          } catch (err) {
            console.error(`讀取分類 ${category.name} 商品失敗:`, err);
          }
        }

        setCategoryProductsList(categoryProductsData);
      }
    } catch (error) {
      console.error('讀取分類失敗：', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch('https://www.anxinshophub.com/api/products/published');
      const data = await response.json();

      if (data.success) {
        const formattedProducts = data.products.map((product: any) => ({
          id: product.id,
          name: product.name,
          price: parseFloat(product.price),
          originalPrice: null,
          image: product.main_image || 'https://via.placeholder.com/400',
          category_id: product.category_id,  // ← 改這裡
          rating: 4.5,
          reviews: 0,
          description: product.description || '暫無描述'
        }));

        setProducts(formattedProducts);
      }
    } catch (error) {
      console.error('讀取商品失敗：', error);
    }
  };

  const fetchWishlist = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch('https://www.anxinshophub.com/api/wishlist', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        // 只取 product_id 組成陣列
        const wishlistIds = data.data.map((item: any) => item.product_id);
        setWishlist(wishlistIds);
      }
    } catch (error) {
      console.error('獲取收藏失敗：', error);
    }
  };

  const fetchBanners = async () => {
    try {
      const response = await fetch('https://www.anxinshophub.com/api/banners');
      const data = await response.json();
      if (data.success) {
        setBanners(data.banners);
      }
    } catch (error) {
      console.error('讀取輪播圖失敗：', error);
    }
  };

  // 輪播圖自動切換
  useEffect(() => {
    if (banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000); // 每 5 秒切換

    return () => clearInterval(interval);
  }, [banners.length]);

  // ← 刪除整個 getCategoryId 函數

  // ← 刪除整個 categories 陣列

  // 過濾商品
  const filteredProducts = products.filter(product => {
    const matchesCategory = currentCategory === 'all' || product.category_id === currentCategory;  // ← 改這裡
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleWishlist = async (productId: number) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('請先登入會員');
      navigate('/login');
      return;
    }

  const isWishlisted = wishlist.includes(productId);

  try {
    if (isWishlisted) {
      // 移除收藏
      const response = await fetch(`https://www.anxinshophub.com/api/wishlist/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        setWishlist(prev => prev.filter(id => id !== productId));
      }
    } else {
      // 新增收藏
      const response = await fetch('https://www.anxinshophub.com/api/wishlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ productId })
      });
      const data = await response.json();

      if (data.success) {
        setWishlist(prev => [...prev, productId]);
      }
    }
  } catch (error) {
    console.error('收藏操作失敗：', error);
    alert('操作失敗，請稍後再試');
  }
};

  const totalItems = cartCount;

  return (
    <div className="home-page">
      {/* Header */}
      <header className="header">
        <div className="header-container">
          <div className="header-content">
            {/* 手機版左側分類按鈕 */}
            {/* 手機版左側分類按鈕 */}
            <button 
              className="mobile-category-btn"
              onClick={() => setIsCategoryOpen(!isCategoryOpen)}
            >
              <Grid size={24} />
            </button>
            {/* Logo */}
              <div className="logo">
                <h1>安鑫購物</h1>
              </div>

               {/* 手機版右側客服按鈕 */}
            <button 
              className="mobile-service-btn"
              onClick={() => setIsLineModalOpen(true)}
            >
              <MessageCircle size={24} />
            </button>

           <nav className="nav-desktop">
              <Link to="/" className="nav-link">首頁</Link>
              <div className="category-dropdown">
                <button 
                  className="nav-link category-btn"
                  onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                >
                  商品分類 ▾
                </button>
                {isCategoryOpen && (
                  <div className="category-menu">
                    {categories.map(category => (
                      <button
                        key={category.id}
                        className="category-menu-item"
                        onClick={() => {
                          setIsCategoryOpen(false);
                          navigate(`/search?category=${encodeURIComponent(category.name)}`);
                        }}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Link to="/search" className="nav-link">搜尋</Link>
              <Link to="/wishlist" className="nav-link">最愛</Link>
              <Link to="/member" className="nav-link">會員</Link>
              <button className="nav-link customer-service-btn" onClick={() => setIsLineModalOpen(true)}>
                <MessageCircle size={18} />
                客服
              </button>
            </nav>

            <div className="search-bar">
              <div className="search-container">
                <Search className="search-icon" size={20} />
                <input
                  type="text"
                  placeholder="搜尋商品..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            <div className="header-actions">
            <button onClick={() => navigate('/cart')} className="cart-button">
              <ShoppingCart size={24} />
              {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
            </button>

              <button onClick={() => setIsMobileMenuOpen(true)} className="mobile-menu-button">
                <Menu size={24} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="overlay" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <h2>選單</h2>
              <button onClick={() => setIsMobileMenuOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <nav className="mobile-nav">
              <Link to="/" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>首頁</Link>
              <a href="#products" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>商品</a>
              <a href="#about" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>關於我們</a>
              <a href="#contact" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>聯絡我們</a>
            </nav>
          </div>
        </div>
      )}

      {/* 手機版分類選單 */}
      {isCategoryOpen && (
        <div className="mobile-category-menu">
          <div className="mobile-category-menu-header">
            <h3>商品分類</h3>
            <button onClick={() => setIsCategoryOpen(false)}>
              <X size={24} />
            </button>
          </div>
          {categories.map(category => (
            <button
              key={category.id}
              className="mobile-category-menu-item"
              onClick={() => {
                setIsCategoryOpen(false);
                navigate(`/search?category=${encodeURIComponent(category.name)}`);
              }}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      {/* Hero Section */}
      <section 
        className="hero"
        style={banners.length > 0 && banners[currentBannerIndex]?.image_url ? {
          backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${banners[currentBannerIndex].image_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        } : {}}
      >
        <div className="hero-container">
          <h2 className="hero-title">
            {banners.length > 0 && banners[currentBannerIndex]?.title 
              ? banners[currentBannerIndex].title 
              : '發現你的完美商品'}
          </h2>
          <p className="hero-subtitle">
            {banners.length > 0 && banners[currentBannerIndex]?.subtitle 
              ? banners[currentBannerIndex].subtitle 
              : '精選商品,品質保證,快速配送'}
          </p>
          <button 
            className="hero-button"
            onClick={() => {
              const linkUrl = banners[currentBannerIndex]?.link_url;
              if (linkUrl) {
                if (linkUrl.startsWith('http://') || linkUrl.startsWith('https://')) {
                  window.open(linkUrl, '_blank');
                } else {
                  navigate(linkUrl);
                }
              } else {
                document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            立即購物
          </button>
          
          {/* 輪播指示點 */}
          {banners.length > 1 && (
            <div className="hero-dots">
              {banners.map((_, index) => (
                <button
                  key={index}
                  className={`hero-dot ${index === currentBannerIndex ? 'active' : ''}`}
                  onClick={() => setCurrentBannerIndex(index)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Products by Category */}
      <section className="products-section" id="products">
        {categoryProductsList.length === 0 ? (
          <div className="empty-products">
            <p>目前沒有商品，請從後台新增商品</p>
          </div>
        ) : (
          categoryProductsList.map(({ category, products }) => (
            <div key={category.id} className="category-section">
              {/* 分類標題 */}
              <div className="category-header">
                <h2 className="category-title">{category.name}</h2>
                <button 
                  className="category-more-btn"
                  onClick={() => navigate(`/search?category=${encodeURIComponent(category.name)}`)}
                >
                  查看更多 →
                </button>
              </div>

              {/* 商品網格 */}
              <div className="products-grid">
                {products.map(product => (
                  <div key={product.id} className="product-card">
                    <div
                      className="product-image-container"
                      onClick={() => navigate(`/product/${product.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <img src={product.image} alt={product.name} className="product-image" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWishlist(product.id);
                        }}
                        className={`wishlist-button ${wishlist.includes(product.id) ? 'active' : ''}`}
                      >
                        ❤
                      </button>
                      {product.originalPrice && <div className="sale-badge">特價</div>}
                    </div>

                    <div className="product-info">
                      <h3
                        className="product-name"
                        onClick={() => navigate(`/product/${product.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        {product.name}
                      </h3>
                      <p className="product-description">{product.description}</p>

                      <div className="product-rating">
                        <span>⭐ {product.rating} ({product.reviews})</span>
                      </div>

                      <div className="product-footer">
                        <div className="price-container">
                          <span className="price">NT$ {product.price.toLocaleString()}</span>
                          {product.originalPrice && (
                            <span className="original-price">
                              NT$ {product.originalPrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <button onClick={() => addToCart(product.id, 1)} className="add-to-cart-button">
                          加入購物車
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* 最底部查看更多 */}
        <div className="view-more-container">
          <button 
            className="view-more-btn"
            onClick={() => navigate('/search')}
          >
            查看更多商品
          </button>
        </div>
      </section>

      {/* LINE 客服彈窗 */}
      {isLineModalOpen && (
        <div className="overlay" onClick={() => setIsLineModalOpen(false)}>
          <div className="line-modal" onClick={(e) => e.stopPropagation()}>
            <div className="line-modal-header">
              <h3>聯絡客服</h3>
              <button onClick={() => setIsLineModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="line-modal-body">
              <img src="/images/line_qrcode.png" alt="LINE QRCode" className="line-qrcode" />
              <p>掃描 QRCode 加入官方 LINE</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-grid">
            <div className="footer-column">
              <h3 className="footer-title">安鑫購物</h3>
              <p className="footer-text">提供最優質的商品與服務,打造完美的購物體驗。</p>


            </div>
            <div className="footer-column" id="contact">
              <h4 className="footer-heading">聯絡資訊</h4>
              <div className="footer-contact">
                <p>電話: 0989206788</p>
                <p>Email: stone.ci7@gmail.com</p>
                <p>地址: 新北市樹林區俊英街81巷25-2號</p>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 ShopHub. All rights reserved.</p>
          </div>
        </div>
      </footer>
      <BottomNav activePage="home" />
    </div>
  );
}

export default HomePage;