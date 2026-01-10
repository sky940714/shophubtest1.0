// src/pages/checkout/OrderDetailPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, MapPin, CreditCard, FileText } from 'lucide-react';
import './styles/OrderDetailPage.css';

interface OrderItem {
  id: number;
  product_name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface OrderDetail {
  id: number;
  order_no: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_email: string;
  shipping_method: string;
  shipping_address?: string;
  shipping_store_name?: string;
  shipping_store_address?: string;
  shipping_fee: number;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  total: number;
  status: string;
  logistics_no?: string;
  note?: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

const OrderDetailPage: React.FC = () => {
  const { orderNo } = useParams<{ orderNo: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (orderNo) {
      fetchOrderDetail();
    }
  }, [orderNo]);

  const fetchOrderDetail = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('請先登入');
        navigate('/login');
        return;
      }

      const response = await fetch(`/api/orders/${orderNo}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setOrder(data.order);
      } else {
        setError(data.message || '取得訂單失敗');
      }
    } catch (error) {
      console.error('取得訂單詳情失敗:', error);
      setError('網路錯誤,請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending': '待處理',
      'processing': '處理中',
      'shipped': '已出貨',
      'delivered': '已送達',
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
      'delivered': 'status-delivered',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled',
    };
    return classMap[status] || '';
  };

  const getPaymentMethodText = (method: string) => {
    const methods: { [key: string]: string } = {
      'cod': '超商取貨付款',
      'Credit': '信用卡',
      'ATM': 'ATM 虛擬帳號',
      'CVS': '超商代碼繳費',
      'WebATM': '網路 ATM',
    };
    return methods[method] || method;
  };

  const getShippingMethodText = (method: string) => {
    return method === 'cvs' ? '超商取貨' : '宅配到府';
  };

  const getPaymentStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending': '待付款',
      'paid': '已付款',
      'failed': '付款失敗',
      'refunded': '已退款',
    };
    return statusMap[status] || status;
  };

  const getPaymentStatusClass = (status: string) => {
    const classMap: { [key: string]: string } = {
      'pending': 'payment-status-pending',
      'paid': 'payment-status-paid',
      'failed': 'payment-status-failed',
      'refunded': 'payment-status-refunded',
    };
    return classMap[status] || '';
  };

  // 載入中
  if (loading) {
    return (
      <div className="order-detail-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">載入中...</p>
        </div>
      </div>
    );
  }

  // 錯誤狀態
  if (error || !order) {
    return (
      <div className="order-detail-page">
        <div className="error-container">
          <p className="error-text">{error || '找不到訂單資料'}</p>
          <button onClick={() => navigate('/checkout/orders')} className="back-to-list-btn">
            返回訂單列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="order-detail-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/checkout/orders')}>
          <ArrowLeft size={20} />
          返回訂單列表
        </button>
      </div>

      <div className="detail-container">
        {/* 訂單狀態卡片 */}
        <div className="status-card">
          <div className="status-header">
            <div className="status-left">
              <h2 className="order-number">訂單編號: {order.order_no}</h2>
              <div className="order-date">
                下單時間: {new Date(order.created_at).toLocaleString('zh-TW', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            <div className="status-right">
              <span className={`order-status ${getStatusClass(order.status)}`}>
                {getStatusText(order.status)}
              </span>
            </div>
          </div>
        </div>

        {/* 物流資訊 */}
        {order.logistics_no && (
          <div className="info-card">
            <div className="card-header">
              <Package size={20} />
              <h3 className="card-title">物流資訊</h3>
            </div>
            <div className="card-content">
              <div className="info-row">
                <span className="info-label">物流單號</span>
                <span className="info-value logistics-no">{order.logistics_no}</span>
              </div>
              <div className="tracking-tip">
                請使用此單號至物流公司官網查詢配送進度
              </div>
            </div>
          </div>
        )}

        {/* 收件資訊 */}
        <div className="info-card">
          <div className="card-header">
            <MapPin size={20} />
            <h3 className="card-title">收件資訊</h3>
          </div>
          <div className="card-content">
            <div className="info-row">
              <span className="info-label">收件人</span>
              <span className="info-value">{order.receiver_name}</span>
            </div>
            <div className="info-row">
              <span className="info-label">聯絡電話</span>
              <span className="info-value">{order.receiver_phone}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Email</span>
              <span className="info-value">{order.receiver_email}</span>
            </div>
            <div className="info-row">
              <span className="info-label">配送方式</span>
              <span className="info-value">{getShippingMethodText(order.shipping_method)}</span>
            </div>
            {order.shipping_method === 'cvs' ? (
              <>
                <div className="info-row">
                  <span className="info-label">取貨門市</span>
                  <span className="info-value">{order.shipping_store_name}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">門市地址</span>
                  <span className="info-value">{order.shipping_store_address}</span>
                </div>
              </>
            ) : (
              <div className="info-row">
                <span className="info-label">配送地址</span>
                <span className="info-value">{order.shipping_address}</span>
              </div>
            )}
            {order.note && (
              <div className="info-row">
                <span className="info-label">備註</span>
                <span className="info-value">{order.note}</span>
              </div>
            )}
          </div>
        </div>

        {/* 付款資訊 */}
        <div className="info-card">
          <div className="card-header">
            <CreditCard size={20} />
            <h3 className="card-title">付款資訊</h3>
          </div>
          <div className="card-content">
            <div className="info-row">
              <span className="info-label">付款方式</span>
              <span className="info-value">{getPaymentMethodText(order.payment_method)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">付款狀態</span>
              <span className={`info-value ${getPaymentStatusClass(order.payment_status)}`}>
                {getPaymentStatusText(order.payment_status)}
              </span>
            </div>
            
            {/* 付款提示 */}
            {order.payment_status === 'pending' && order.payment_method !== 'cod' && (
              <div className="payment-notice">
                <p>⚠️ 請盡快完成付款,逾期訂單將自動取消</p>
              </div>
            )}
          </div>
        </div>

        {/* 訂單商品 */}
        <div className="info-card">
          <div className="card-header">
            <FileText size={20} />
            <h3 className="card-title">訂單商品</h3>
          </div>
          <div className="card-content">
            <div className="items-list">
              {order.items.map((item) => (
                <div key={item.id} className="order-item">
                  <div className="item-main">
                    <div className="item-info">
                      <div className="item-name">{item.product_name}</div>
                      <div className="item-price">單價: NT$ {item.price.toLocaleString()}</div>
                    </div>
                    <div className="item-right">
                      <div className="item-quantity">x {item.quantity}</div>
                      <div className="item-subtotal">
                        NT$ {item.subtotal.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="order-summary">
              <div className="summary-row">
                <span>商品小計</span>
                <span>NT$ {order.subtotal.toLocaleString()}</span>
              </div>
              <div className="summary-row">
                <span>運費</span>
                <span>NT$ {order.shipping_fee.toLocaleString()}</span>
              </div>
              <div className="summary-divider"></div>
              <div className="summary-row total">
                <span>訂單總額</span>
                <span className="total-amount">NT$ {order.total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 操作按鈕區 */}
        {order.status === 'pending' && order.payment_status === 'pending' && (
          <div className="action-buttons">
            <button className="btn-cancel-order">取消訂單</button>
            {order.payment_method !== 'cod' && (
              <button className="btn-pay-now">立即付款</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderDetailPage;