import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// 購物車項目介面
interface CartItem {
  cart_item_id: number;
  product_id: number;
  variant_id?: number;        // ✅ 新增
  variant_name?: string;      // ✅ 新增
  name: string;
  price: number;
  quantity: number;
  stock: number;
  status: string;
  image_url: string;
}

// Context 介面
interface CartContextType {
  cartCount: number;
  cartItems: CartItem[];
  addToCart: (productId: number, quantity?: number, variantId?: number) => Promise<void>;
  removeFromCart: (cartItemId: number) => Promise<void>;
  updateQuantity: (cartItemId: number, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  loading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Provider Props
interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartCount, setCartCount] = useState<number>(0);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // 初始化：載入購物車
  useEffect(() => {
    refreshCart();
  }, []);

  // 重新整理購物車
  const refreshCart = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setCartCount(0);
      setCartItems([]);
      return;
    }

    try {
      const response = await fetch('/api/cart', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setCartItems(data.cart.items);
        setCartCount(data.cart.totalQuantity || 0);
      }
    } catch (error) {
      console.error('獲取購物車失敗：', error);
    }
  };

  // 加入購物車
  const addToCart = async (productId: number, quantity: number = 1, variantId?: number) => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      alert('請先登入');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: productId,
          quantity: quantity,
          variant_id: variantId
        })
      });

      const data = await response.json();

      if (data.success) {
        await refreshCart();
      } else {
        alert(data.message || '加入購物車失敗');
      }
    } catch (error) {
      console.error('加入購物車失敗：', error);
      alert('加入購物車失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 移除商品
  const removeFromCart = async (cartItemId: number) => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      alert('請先登入');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/cart/remove/${cartItemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        await refreshCart();
      } else {
        alert(data.message || '刪除失敗');
      }
    } catch (error) {
      console.error('刪除失敗：', error);
      alert('刪除失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 更新數量
  const updateQuantity = async (cartItemId: number, quantity: number) => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      alert('請先登入');
      return;
    }

    if (quantity < 1) {
      await removeFromCart(cartItemId);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/cart/update/${cartItemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ quantity })
      });

      const data = await response.json();

      if (data.success) {
        await refreshCart();
      } else {
        alert(data.message || '更新失敗');
      }
    } catch (error) {
      console.error('更新失敗：', error);
      alert('更新失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 清空購物車
  const clearCart = async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      alert('請先登入');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/cart/clear', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        await refreshCart();
      } else {
        alert(data.message || '清空失敗');
      }
    } catch (error) {
      console.error('清空失敗：', error);
      alert('清空失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CartContext.Provider
      value={{
        cartCount,
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        refreshCart,
        loading
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

// Hook
export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart 必須在 CartProvider 內使用');
  }
  return context;
};