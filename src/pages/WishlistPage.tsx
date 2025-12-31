import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Trash2, Loader } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import './WishlistPage.css';
// 引入你提供的 CartContext
import { useCart } from '../context/CartContext';

// 定義介面 (根據後端回傳的資料結構)
interface WishlistProduct {
  wishlist_id: number;
  product_id: number;
  name: string;
  price: number;
  image_url: string;
  stock: number;
  status: string;
  variant_count: number;
}

const WishlistPage: React.FC = () => {
  const [wishlist, setWishlist] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { addToCart } = useCart(); // 使用全域購物車功能
  const navigate = useNavigate();
  const API_BASE = 'https://www.anxinshophub.com/api';

  // 1. 獲取收藏清單
  const fetchWishlist = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('請先登入會員');
      navigate('/login'); // 導向登入頁
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/wishlist`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.success) {
        setWishlist(data.data);
      }
    } catch (error) {
      console.error('獲取收藏失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, []);

  // 2. 移除收藏功能
  const removeFromWishlist = async (productId: number) => {
  if (!window.confirm('確定要移除此收藏嗎？')) return;
  
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
      const res = await fetch(`${API_BASE}/wishlist/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.success) {
        // 前端直接過濾掉該商品，不需重新 fetch，體驗較快
        setWishlist(prev => prev.filter(item => item.product_id !== productId));
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('移除失敗，請稍後再試');
    }
  };

  // 3. 加入購物車處理
  const handleAddToCart = async (product: WishlistProduct) => {
  if (product.variant_count > 0) {
    navigate(`/product/${product.product_id}`);
    return;
  }
    await addToCart(product.product_id, 1);
  };

  if (loading) {
    return (
      <div className="wishlist-page loading-center">
        <Loader className="animate-spin" size={48} />
        <p>載入最愛清單中...</p>
      </div>
    );
  }

  return (
    <div className="wishlist-page">
      {/* Header */}
      <header className="wishlist-header">
        <div className="wishlist-header-content">
          <Link to="/" className="back-button">← 返回</Link>
          <h1 className="wishlist-title">我的最愛</h1>
        </div>
      </header>

      {/* Main Container */}
      <div className="wishlist-container">
        {wishlist.length === 0 ? (
          <div className="empty-wishlist">
            <Heart size={64} className="empty-icon" />
            <h2>還沒有收藏的商品</h2>
            <p>快去逛逛,把喜歡的商品加入最愛吧!</p>
            <Link to="/" className="browse-button">
              開始購物
            </Link>
          </div>
        ) : (
          <>
            <div className="wishlist-info">
              <p>共 {wishlist.length} 件商品</p>
            </div>
            <div className="wishlist-grid">
              {wishlist.map(product => {
                const inStock = product.stock > 0;
                
                return (
                  <div key={product.product_id} className="wishlist-card">
                    <button
                      onClick={() => removeFromWishlist(product.product_id)}
                      className="remove-wishlist-btn"
                      title="移除收藏"
                    >
                      <Trash2 size={20} />
                    </button>
                    
                    {!inStock && (
                      <div className="out-of-stock-badge">已售完</div>
                    )}

                    <img
                      src={product.image_url || 'https://via.placeholder.com/400'} 
                      alt={product.name}
                      className="wishlist-product-image"
                      onClick={() => navigate(`/product/${product.product_id}`)}
                      style={{ cursor: 'pointer' }}
                    />

                    <div className="wishlist-product-info">
                      <h3 
                        className="wishlist-product-name"
                        onClick={() => navigate(`/product/${product.product_id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        {product.name}
                      </h3>
                      
                      {/* 如果資料庫沒有評分欄位，先隱藏或顯示預設值 */}
                      {/* <div className="wishlist-product-rating">⭐ 4.5</div> */}

                      <div className="wishlist-product-price">
                        <span className="price">NT$ {product.price.toLocaleString()}</span>
                      </div>

                      <button
                        onClick={() => handleAddToCart(product)}
                        className={`add-to-cart-btn ${!inStock ? 'disabled' : ''}`}
                        disabled={!inStock}
                      >
                        {inStock ? '加入購物車' : '已售完'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      <BottomNav activePage="wishlist" />
    </div>
  );
};

export default WishlistPage;