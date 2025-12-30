// src/pages/ProductDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Star } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Thumbs } from 'swiper/modules';
import { useCart } from '../context/CartContext';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/thumbs';
import './ProductDetailPage.css';

// ⭐ 新增：商品規格介面
interface ProductVariant {
  id: number;
  product_id: number;
  variant_name: string;
  price: number;
  stock: number;
}

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  description: string;
  image_url: string;
  category_id: number;
  status: string;
  category_name?: string;
  variants?: ProductVariant[];  // ⭐ 新增
  images?: Array<{
    id: number;
    product_id: number;
    image_url: string;
    sort_order: number;
    is_main: number;
  }>;
}

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [thumbsSwiper, setThumbsSwiper] = useState<any>(null);
  
  // ⭐ 新增：選中的規格
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  
  // ⭐ 新增：描述展開狀態
  const [showFullDescription, setShowFullDescription] = useState(false);

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const response = await fetch(`https://www.anxinshophub.com/api/products/${id}`);
        const data = await response.json();

        if (data.success) {
          setProduct(data.product);
          
          // ⭐ 新增：自動選擇第一個有庫存的規格
          if (data.product.variants && data.product.variants.length > 0) {
            const firstAvailableVariant = data.product.variants.find(
              (v: ProductVariant) => v.stock > 0
            );
            setSelectedVariant(firstAvailableVariant || data.product.variants[0]);
          }
        }
      } catch (error) {
        console.error('讀取商品失敗：', error);
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  // ⭐ 新增：處理規格選擇
  const handleVariantSelect = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setQuantity(1); // 重置數量
  };

  // ⭐ 新增：切換描述展開
  const toggleDescription = () => {
    setShowFullDescription(!showFullDescription);
  };

  const handleAddToCart = async () => {
    if (!product) return;
    
    // ⭐ 新增：檢查是否選擇規格
    if (product.variants && product.variants.length > 1 && !selectedVariant) {
      alert('請選擇商品規格');
      return;
    }
    
    try {
      // ⭐ 修改：傳送 variant_id
      await addToCart(product.id, quantity, selectedVariant?.id);
      alert('已加入購物車！');
      setQuantity(1);
    } catch (error) {
      console.error('加入購物車失敗:', error);
      alert('加入購物車失敗,請稍後再試');
    }
  };

  const handleBuyNow = () => {
    if (!product) return;
    
    // ⭐ 新增：檢查是否選擇規格
    if (product.variants && product.variants.length > 1 && !selectedVariant) {
      alert('請選擇商品規格');
      return;
    }
    
    navigate('/checkout', {
      state: {
        directBuy: true,
        items: [{
          cart_item_id: 0,
          product_id: product.id,
          variant_id: selectedVariant?.id,  // ⭐ 新增
          variant_name: selectedVariant?.variant_name,  // ⭐ 新增
          name: product.name,
          price: selectedVariant?.price || product.price,  // ⭐ 修改
          quantity: quantity,
          image_url: product.image_url,
        }]
      }
    });
  };

  const increaseQuantity = () => {
    // ⭐ 修改：使用 selectedVariant 的庫存
    const maxStock = selectedVariant?.stock || product?.stock || 0;
    if (quantity < maxStock) {
      setQuantity(quantity + 1);
    }
  };

  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading">載入中...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="error-container">
        <div className="error">找不到商品</div>
        <button onClick={() => navigate('/')} className="back-home-btn">
          返回首頁
        </button>
      </div>
    );
  }

  return (
    <div className="product-detail-page">
      <button className="back-button" onClick={() => navigate('/')}>
        <ArrowLeft size={20} />
        返回
      </button>

      <div className="product-detail-container">
        <div className="product-image-section">
          {/* 主圖輪播 */}
          <Swiper
            modules={[Navigation, Pagination, Thumbs]}
            navigation
            pagination={{ clickable: true }}
            thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }}
            className="main-swiper"
            style={{ maxWidth: '100%', width: '100%' }}
          >
            {product.images && product.images.length > 0 ? (
              product.images.map((img, index) => (
                <SwiperSlide key={img.id || index}>
                  <img 
                    src={img.image_url} 
                    alt={`${product.name} - 圖片 ${index + 1}`}
                    className="main-product-image"
                  />
                </SwiperSlide>
              ))
            ) : (
              <SwiperSlide>
                <img 
                  src="https://via.placeholder.com/500" 
                  alt={product.name}
                  className="main-product-image"
                />
              </SwiperSlide>
            )}
          </Swiper>

          {/* 縮圖輪播 */}
          {product.images && product.images.length > 1 && (
            <Swiper
              onSwiper={setThumbsSwiper}
              modules={[Thumbs]}
              spaceBetween={10}
              slidesPerView={4}
              watchSlidesProgress
              className="thumbs-swiper"
              style={{ maxWidth: '100%', width: '100%' }}
            >
              {product.images.map((img, index) => (
                <SwiperSlide key={img.id || index}>
                  <img 
                    src={img.image_url} 
                    alt={`縮圖 ${index + 1}`}
                    className="thumb-image"
                  />
                </SwiperSlide>
              ))}
            </Swiper>
          )}
        </div>

        <div className="product-info-section">
          <h1 className="product-title">{product.name}</h1>

          <div className="rating-section">
            <div className="stars">
              <Star fill="#fbbf24" color="#fbbf24" size={20} />
              <span className="rating-text">4.5</span>
            </div>
            <span className="divider">|</span>
            <span className="sales-text">已售出 {(selectedVariant?.stock || product.stock) > 100 ? '100+' : (selectedVariant?.stock || product.stock)}</span>
          </div>

          <div className="price-section">
            <span className="price-label">NT$</span>
            <span className="price-value">
              {(selectedVariant?.price || product.price).toLocaleString()}
            </span>
          </div>

          {/* ⭐ 新增：規格選擇器（只在多規格時顯示） */}
          {product.variants && product.variants.length > 1 && (
            <div className="variant-selector">
              <h3 className="section-title">規格</h3>
              <div className="variant-options">
                {product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    className={`variant-option ${
                      selectedVariant?.id === variant.id ? 'selected' : ''
                    } ${variant.stock === 0 ? 'sold-out' : ''}`}
                    onClick={() => handleVariantSelect(variant)}
                    disabled={variant.stock === 0}
                  >
                    <div className="variant-name">{variant.variant_name}</div>
                    <div className="variant-info">
                      <span className="variant-price">NT$ {variant.price.toLocaleString()}</span>
                      <span className="variant-stock">庫存 {variant.stock}</span>
                    </div>
                    {variant.stock === 0 && <div className="sold-out-badge">售罄</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ⭐ 修改：可展開/收合的商品描述 */}
          <div className="description-section">
            <h3 className="section-title">商品描述</h3>
            <p className={`description-text ${showFullDescription ? 'expanded' : 'collapsed'}`}>
              {product.description || '暫無描述'}
            </p>
            {product.description && product.description.length > 100 && (
              <button className="show-more-btn" onClick={toggleDescription}>
                {showFullDescription ? '收起 ▲' : '顯示更多 ▼'}
              </button>
            )}
          </div>

          <div className="stock-section">
            <span className="stock-label">庫存：</span>
            <span className="stock-value">
              {selectedVariant?.stock || product.stock} 件
            </span>
          </div>

          <div className="quantity-section">
            <span className="quantity-label">數量：</span>
            <div className="quantity-controls">
              <button 
                className="quantity-button"
                onClick={decreaseQuantity}
                disabled={quantity <= 1}
              >
                -
              </button>
              <input 
                type="number" 
                value={quantity}
                readOnly
                className="quantity-input"
              />
              <button 
                className="quantity-button"
                onClick={increaseQuantity}
                disabled={quantity >= (selectedVariant?.stock || product.stock)}
              >
                +
              </button>
            </div>
          </div>

          <div className="action-buttons">
            <button className="add-to-cart-btn" onClick={handleAddToCart}>
              <ShoppingCart size={20} />
              加入購物車
            </button>
            <button className="buy-now-btn" onClick={handleBuyNow}>
              立即購買
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;