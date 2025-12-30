import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X, TrendingUp, Loader } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import './SearchPage.css'; 

// 定義後端回傳的資料格式
interface BackendProduct {
  id: number;
  name: string;
  price: number;
  description?: string;
  stock: number;
  category_names: string | null;
  main_image: string | null;
  created_at?: string;
}

// 定義前端顯示用的資料格式
interface DisplayProduct {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  rating: number;
}

const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // 狀態管理
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [allProducts, setAllProducts] = useState<DisplayProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 從 localStorage 讀取歷史紀錄
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('recentSearches');
      return saved ? JSON.parse(saved) : ['白色T恤', '藍牙耳機', '咖啡豆'];
    } catch (e) {
      return ['白色T恤', '藍牙耳機', '咖啡豆'];
    }
  });

  const hotKeywords = ['特價商品', '新品上市', '熱銷排行', '限時優惠'];

  // 1. 初始化：從後端抓取所有「上架中」的商品
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        // 呼叫後端 API
        const response = await fetch('https://www.anxinshophub.com/api/products/published');
        
        if (!response.ok) {
          throw new Error('無法連線至伺服器');
        }

        const data = await response.json();

        if (data.success && Array.isArray(data.products)) {
          // 資料轉換：將後端欄位對應到前端 UI
          const mappedProducts: DisplayProduct[] = data.products.map((p: BackendProduct) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            originalPrice: undefined, 
            image: p.main_image 
              ? (p.main_image.startsWith('http') ? p.main_image : `/uploads/${p.main_image}`)
              : 'https://placehold.co/300x300?text=No+Image', 
            category: p.category_names || '未分類',
            rating: 5.0, 
          }));
          setAllProducts(mappedProducts);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        setError('目前無法載入商品目錄，請稍後再試。');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // 讀取 URL 分類參數
  useEffect(() => {
    const category = searchParams.get('category');
    if (category) {
      setCategoryFilter(category);
      setSearchTerm(category);
    }
  }, [searchParams]);

  // 2. 監聽歷史紀錄變化並存入 LocalStorage
  useEffect(() => {
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
  }, [recentSearches]);

  // 3. 即時過濾搜尋結果 (由前端計算，速度極快)
  const searchResults = useMemo(() => {
    // 如果有分類篩選
    if (categoryFilter) {
      return allProducts.filter(product => {
        // 【修正重點】將 "A,B,C" 切割成陣列，檢查是否包含目前的篩選值
        // 這樣商品不管有幾個分類，只要包含當前選的，就會顯示
        if (!product.category) return false;
        const categories = product.category.split(','); 
        return categories.includes(categoryFilter);
      });
    }
    
    if (!searchTerm.trim()) return [];
    
    const lowerTerm = searchTerm.toLowerCase();
    // 搜尋邏輯保持不變 (文字搜尋包含即可)
    return allProducts.filter(product => 
      product.name.toLowerCase().includes(lowerTerm) || 
      product.category.toLowerCase().includes(lowerTerm)
    );
  }, [searchTerm, categoryFilter, allProducts]);

  const handleClearSearch = () => {
    setSearchTerm('');
    setCategoryFilter('');
    navigate('/search');
  };

  const handleSearch = (keyword: string) => {
    setSearchTerm(keyword);
    // 加入歷史紀錄 (去除重複並保持最新的在前面，保留前 6 筆)
    const newHistory = [keyword, ...recentSearches.filter(k => k !== keyword)].slice(0, 6);
    setRecentSearches(newHistory);
  };

  const removeRecentSearch = (keyword: string) => {
    setRecentSearches(recentSearches.filter(item => item !== keyword));
  };

  return (
    <div className="search-page">
      {/* Header */}
      <header className="search-header">
        <div className="search-header-content">
          <Link to="/" className="back-button">← 返回</Link>
          <h1 className="search-title">搜尋商品</h1>
        </div>
      </header>

      {/* Search Container */}
      <div className="search-main-container">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch(searchTerm)}
            placeholder="搜尋商品名稱或分類..."
            className="search-input"
            autoFocus
          />
          {searchTerm && (
            <button onClick={handleClearSearch} className="clear-button">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="loading-state">
            <Loader className="animate-spin" size={24} />
            <span>正在載入商品目錄...</span>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        {/* Recent Searches (只有在沒搜尋文字且載入完畢時顯示) */}
        {!isLoading && recentSearches.length > 0 && !searchTerm && (
          <div className="search-section">
            <h2 className="section-title">最近搜尋</h2>
            <div className="keyword-list">
              {recentSearches.map((keyword, index) => (
                <div key={index} className="keyword-item">
                  <button
                    onClick={() => handleSearch(keyword)}
                    className="keyword-button"
                  >
                    {keyword}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecentSearch(keyword);
                    }}
                    className="remove-button"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hot Keywords */}
        {!isLoading && !searchTerm && (
          <div className="search-section">
            <h2 className="section-title">
              <TrendingUp size={20} />
              熱門搜尋
            </h2>
            <div className="hot-keywords">
              {hotKeywords.map((keyword, index) => (
                <button
                  key={index}
                  onClick={() => handleSearch(keyword)}
                  className="hot-keyword-button"
                >
                  {keyword}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        {!isLoading && searchTerm && (
          <div className="search-results">
            {searchResults.length === 0 ? (
              <div className="empty-results">
                <p>找不到「{searchTerm}」的相關商品</p>
                <p className="empty-hint">試試其他關鍵字或瀏覽熱門商品</p>
              </div>
            ) : (
              <div className="results-grid">
                {searchResults.map(product => (
                  <Link to={`/product/${product.id}`} key={product.id} className="product-card-link">
                    <div className="product-card">
                      <div className="product-image-container">
                         <img 
                           src={product.image} 
                           alt={product.name} 
                           className="product-image"
                           onError={(e) => {
                             (e.target as HTMLImageElement).src = 'https://placehold.co/300x300?text=No+Image';
                           }}
                         />
                      </div>
                      <div className="product-info">
                        <h3 className="product-name">{product.name}</h3>
                        <div className="product-meta">
                           <span className="product-category">{product.category}</span>
                        </div>
                        <div className="product-price-row">
                          <span className="price">NT$ {product.price.toLocaleString()}</span>
                          {product.originalPrice && (
                            <span className="original-price">
                              NT$ {product.originalPrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="product-rating">⭐ {product.rating}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <BottomNav activePage="search" />
    </div>
  );
};

export default SearchPage;