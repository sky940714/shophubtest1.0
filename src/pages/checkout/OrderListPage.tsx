// src/pages/checkout/OrderListPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ChevronRight, ArrowLeft } from 'lucide-react';
import './styles/OrderListPage.css';

interface Order {
  id: number;
  order_no: string;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
  items_count: number;
}

const OrderListPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://www.anxinshophub.com/api/orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setOrders(data.orders);
      }
    } catch (error) {
      console.error('取得訂單列表失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending': '待處理',
      'processing': '處理中',
      'shipped': '已出貨',
      'completed': '已完成',
      'cancelled': '已取消',
    };
    return statusMap[status] || status;
  };

  const getStatusClass = (status: string) => {
    const classMap: { [key: string]: string } = {
      'pending': 'status-pending',
      'processing': 'status-processing',
      'shipped': 'status-shipped',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled',
    };
    return classMap[status] || '';
  };

  const getPaymentStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending': '待付款',
      'paid': '已付款',
      'failed': '付款失敗',
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className="order-list-page">
        <div className="loading">載入中...</div>
      </div>
    );
  }

  return (
    <div className="order-list-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
          返回首頁
        </button>
        <h1 className="page-title">我的訂單</h1>
      </div>

      <div className="orders-container">
        {orders.length === 0 ? (
          <div className="empty-orders">
            <Package size={64} color="#d1d5db" />
            <p className="empty-text">您還沒有任何訂單</p>
            <button className="shop-now-btn" onClick={() => navigate('/')}>
              開始購物
            </button>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <div
                key={order.id}
                className="order-card"
                onClick={() => navigate(`/checkout/orders/${order.order_no}`)}
              >
                <div className="order-header">
                  <div className="order-info">
                    <span className="order-no">訂單編號: {order.order_no}</span>
                    <span className="order-date">
                      {new Date(order.created_at).toLocaleDateString('zh-TW')}
                    </span>
                  </div>
                  <div className="order-status-group">
                    <span className={`order-status ${getStatusClass(order.status)}`}>
                      {getStatusText(order.status)}
                    </span>
                    <span className="payment-status">
                      {getPaymentStatusText(order.payment_status)}
                    </span>
                  </div>
                </div>

                <div className="order-body">
                  <div className="order-summary">
                    <span className="items-count">共 {order.items_count} 件商品</span>
                    <span className="order-total">NT$ {order.total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="order-footer">
                  <button className="view-detail-btn">
                    查看詳情
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderListPage;