// pages/admin/components/CategoryManagement.tsx
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, GripVertical, Eye} from 'lucide-react';
import CategoryProductModal from './CategoryProductModal';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import '../styles/CategoryManagement.css';

interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  level: number;
  sort_order: number;
  is_active: number;
  productCount: number;
  created_at: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  status: string;
}

// 可拖拽的分類卡片組件
const SortableCategory: React.FC<{
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onView: (category: Category) => void;
}> = ({ category, onEdit, onDelete, onView }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`category-card ${isDragging ? 'dragging' : ''}`}
    >
      <div className="category-content">
        <div className="drag-handle" {...attributes} {...listeners}>
          <GripVertical className="drag-icon" />
        </div>
        <div className="category-info">
          <h3 className="category-name">{category.name}</h3>
          <p className="category-count">商品數量: {category.productCount}</p>
        </div>
        <div className="category-actions">
          <button
            className="btn-icon-view"
            onClick={() => onView(category)}
            title="查看商品"
          >
            <Eye className="icon" />
          </button>
          <button
            className="btn-icon-edit"
            onClick={() => onEdit(category)}
            title="編輯"
          >
            <Edit2 className="icon" />
          </button>
          <button
            className="btn-icon-delete"
            onClick={() => onDelete(category)}
            title="刪除"
          >
            <Trash2 className="icon" />
          </button>
        </div>
      </div>
    </div>
  );
};

const CategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // 設定拖拽感應器
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8, // 移動8px後開始拖拽
    },
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);

  // 載入分類列表
  useEffect(() => {
    fetchCategories();
  }, []);

  // 取得所有分類
  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('https://www.anxinshophub.com/api/categories');
      const data = await response.json();

      if (data.success) {
        setCategories(data.categories);
      } else {
        setError('取得分類失敗');
      }
    } catch (error) {
      console.error('取得分類失敗:', error);
      setError('無法載入分類列表');
    } finally {
      setLoading(false);
    }
  };

    // 處理拖拽開始
    const handleDragStart = (event: DragStartEvent) => {
      setActiveId(event.active.id as number);
    };

    // 處理拖拽結束
const handleDragEnd = async (event: DragEndEvent) => {
  const { active, over } = event;

  setActiveId(null);

  if (!over || active.id === over.id) {
    return;
  }

  const oldIndex = categories.findIndex((cat) => cat.id === active.id);
  const newIndex = categories.findIndex((cat) => cat.id === over.id);

  // 更新本地順序
  const newCategories = arrayMove(categories, oldIndex, newIndex);

  // 更新 sort_order
  const updatedCategories = newCategories.map((cat, index) => ({
    ...cat,
    sort_order: index + 1,
  }));

  setCategories(updatedCategories);

  // 保存到後端
  await saveOrder(updatedCategories);
};

  // 保存排序到後端
  const saveOrder = async (orderedCategories: Category[]) => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem('token');
      if (!token) {
        alert('請先登入');
        return;
      }

      const response = await fetch('https://www.anxinshophub.com/api/categories/update-order', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          categories: orderedCategories.map((cat) => ({
            id: cat.id,
            sort_order: cat.sort_order,
          })),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        alert('保存排序失敗');
        // 失敗時重新載入
        fetchCategories();
      }
    } catch (error) {
      console.error('保存排序失敗:', error);
      alert('保存排序時發生錯誤');
      fetchCategories();
    } finally {
      setIsSaving(false);
    }
  };

  // 新增分類
  const handleAddCategory = async () => {
    const name = prompt('請輸入新分類名稱：');
    if (!name || name.trim() === '') return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('請先登入');
        return;
      }

      const response = await fetch('https://www.anxinshophub.com/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          parent_id: null,
          level: 1,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('分類新增成功！');
        fetchCategories();
      } else {
        alert(data.message || '新增失敗');
      }
    } catch (error) {
      console.error('新增分類失敗:', error);
      alert('新增分類時發生錯誤');
    }
  };

  // 編輯分類
  const handleEditCategory = async (category: Category) => {
    const newName = prompt('請輸入新的分類名稱：', category.name);
    if (!newName || newName.trim() === '' || newName === category.name) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('請先登入');
        return;
      }

      const response = await fetch(`https://www.anxinshophub.com/api/categories/${category.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newName.trim(),
          parent_id: category.parent_id,
          level: category.level,
          is_active: category.is_active,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('分類更新成功！');
        fetchCategories();
      } else {
        alert(data.message || '更新失敗');
      }
    } catch (error) {
      console.error('更新分類失敗:', error);
      alert('更新分類時發生錯誤');
    }
  };

  // 刪除分類
  const handleDeleteCategory = async (category: Category) => {
    if (!window.confirm(`確定要刪除「${category.name}」分類嗎？`)) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('請先登入');
        return;
      }

      const response = await fetch(`https://www.anxinshophub.com/api/categories/${category.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        alert('分類刪除成功！');
        fetchCategories();
      } else {
        alert(data.message || '刪除失敗');
      }
    } catch (error) {
      console.error('刪除分類失敗:', error);
      alert('刪除分類時發生錯誤');
    }
  };

  // 查看分類商品
  const handleViewCategory = async (category: Category) => {
    setSelectedCategory(category);
    setShowProductModal(true);
    setProductsLoading(true);

    try {
      const response = await fetch(`https://www.anxinshophub.com/api/products/category/${category.id}`);
      const data = await response.json();

      if (data.success) {
        setCategoryProducts(data.products || []);
      } else {
        setCategoryProducts([]);
      }
    } catch (error) {
      console.error('取得分類商品失敗:', error);
      setCategoryProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  // 關閉商品 Modal
  const closeProductModal = () => {
    setShowProductModal(false);
    setSelectedCategory(null);
    setCategoryProducts([]);
  };

  // 載入中
  if (loading) {
    return (
      <div className="category-management">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>載入中...</p>
        </div>
      </div>
    );
  }

  // 錯誤處理
  if (error) {
    return (
      <div className="category-management">
        <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>
          <p>{error}</p>
          <button
            onClick={fetchCategories}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            重新載入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="category-management">
      <div className="page-header">
        <div>
          <h2 className="page-title">分類管理</h2>
          {isSaving && <span className="saving-indicator">保存中...</span>}
        </div>
        <button className="btn-primary" onClick={handleAddCategory}>
          <Plus className="btn-icon" />
          新增分類
        </button>
      </div>

      <div className="category-list">
        {categories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>目前沒有任何分類</p>
          </div>
        ) : (
         <DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
  <SortableContext
    items={categories.map((cat) => cat.id)}
    strategy={verticalListSortingStrategy}
  >
    {categories.map((category) => (
      <SortableCategory
        key={category.id}
        category={category}
        onEdit={handleEditCategory}
        onDelete={handleDeleteCategory}
        onView={handleViewCategory} 
      />
    ))}
  </SortableContext>
  <DragOverlay>
    {activeId ? (
      <div className="category-card">
        <div className="category-content">
          <div className="drag-handle">
            <GripVertical className="drag-icon" />
          </div>
          <div className="category-info">
            <h3 className="category-name">
              {categories.find(cat => cat.id === activeId)?.name}
            </h3>
            <p className="category-count">
              商品數量: {categories.find(cat => cat.id === activeId)?.productCount}
            </p>
          </div>
        </div>
      </div>
    ) : null}
  </DragOverlay>
</DndContext>
        )}
      </div>

      {/* ⭐ 替換成新的組件 */}
      <CategoryProductModal 
        isOpen={showProductModal}
        onClose={closeProductModal}
        category={selectedCategory}
        products={categoryProducts}
        loading={productsLoading}
      />
    </div>
  );
};

export default CategoryManagement;