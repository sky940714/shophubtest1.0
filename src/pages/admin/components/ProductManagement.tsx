// pages/admin/components/ProductManagement.tsx
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import ProductModal from './ProductModal';
import '../styles/ProductManagement.css';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  variantCount: number;
  image: string;
  description: string;
  status: 'active' | 'inactive';
}

const ProductManagement: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
  try {
    const response = await fetch('https://www.anxinshophub.com/api/products');
    const data = await response.json();

    if (data.success) {
      // 轉換資料格式以符合前端需求
      const formattedProducts = data.products.map((product: any) => ({
        id: product.id.toString(),
        name: product.name,
        category: getCategoryName(product.category_id),
        price: parseFloat(product.price),
        stock: product.stock,
        variantCount: product.variant_count || 0,
        image: product.image_url || '/placeholder.png',
        description: product.description || '',
        status: product.status === '上架' ? 'active' : 'inactive'
      }));

      setProducts(formattedProducts);
    }
  } catch (error) {
    console.error('讀取商品失敗：', error);
    alert('讀取商品失敗，請稍後再試');
  }
};

// 將分類 ID 轉換為分類名稱
const getCategoryName = (categoryId: number): string => {
  const categoryMap: { [key: number]: string } = {
    1: '服飾',
    2: '電子產品',
    3: '食品',
    4: '配件',
    5: '居家用品'
  };
  return categoryMap[categoryId] || '其他';
};

  const handleAddProduct = () => {
    setEditingProduct(null);
    setShowModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleDeleteProduct = async (id: string) => {
  if (!window.confirm('確定要刪除此商品嗎？')) return;

  try {
    const token = localStorage.getItem('token');

    const response = await fetch(`https://www.anxinshophub.com/api/products/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (data.success) {
      alert('商品已刪除！');
      fetchProducts(); // 重新讀取商品列表
    } else {
      alert(data.message || '刪除失敗');
    }
  } catch (error) {
    console.error('刪除商品失敗：', error);
    alert('刪除失敗，請稍後再試');
  }
};

  const handleSaveProduct = (product: Product) => {
  setShowModal(false);
  // 重新讀取商品列表以顯示最新資料
  fetchProducts();
};

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="product-management">
      <div className="page-header">
        <h2 className="page-title">商品管理</h2>
        <button className="btn-primary" onClick={handleAddProduct}>
          <Plus className="btn-icon" />
          新增商品
        </button>
      </div>

      <div className="content-card">
        <div className="search-bar">
          <div className="search-input-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="搜尋商品名稱..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>商品名稱</th>
                <th>分類</th>
                <th>價格</th>
                <th>庫存</th>
                <th>規格</th>
                <th>狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id}>
                  <td className="product-name">{product.name}</td>
                  <td>{product.category}</td>
                  <td className="product-price">NT$ {product.price.toLocaleString()}</td>
                  <td>
                    <span className={product.stock < 20 ? 'stock-low' : 'stock-normal'}>
                      {product.stock}
                    </span>
                  </td>
                  <td>
                    {product.variantCount > 0 ? `${product.variantCount} 種規格` : '無'}
                  </td>
                  <td>
                    <span className={`status-badge ${product.status === 'active' ? 'status-active' : 'status-inactive'}`}>
                      {product.status === 'active' ? '上架中' : '已下架'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon-edit"
                        onClick={() => handleEditProduct(product)}
                        title="編輯"
                      >
                        <Edit2 className="icon" />
                      </button>
                      <button
                        className="btn-icon-delete"
                        onClick={() => handleDeleteProduct(product.id)}
                        title="刪除"
                      >
                        <Trash2 className="icon" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredProducts.length === 0 && (
            <div className="empty-state">
              <p>找不到符合的商品</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <ProductModal
          product={editingProduct}
          onClose={() => setShowModal(false)}
          onSave={handleSaveProduct}
        />
      )}
    </div>
  );
};

export default ProductManagement;