// src/pages/checkout/OrderSuccessPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Package, Home } from 'lucide-react';
import './styles/OrderSuccessPage.css';

interface OrderDetail {
  order_no: string;
  total: number;
  payment_method: string;
  shipping_method: string;
  created_at: string;
}

const OrderSuccessPage: React.FC = () => {
  const { orderNo } = useParams<{ orderNo: string }>();
  const navigate = useNavigate();
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderDetail();
  }, [orderNo]);

  const fetchOrderDetail = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`https://www.anxinshophub.com/api/orders/${orderNo}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setOrderDetail(data.order);
      }
    } catch (error) {
      console.error('取得訂單資料失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPaymentMethodText = (method: string) => {
    const methods: { [key: string]: string } = {
      'cod': '超商取貨付款',
      'Credit': '信用卡',
      'ATM': 'ATM 虛擬帳號',
      'CVS': '超商代碼繳費',
    };
    return methods[method] || method;
  };

  const getShippingMethodText = (method: string) => {
    return method === 'cvs' ? '超商取貨' : '宅配到府';
  };

  if (loading) {
    return (
      <div className="order-success-page">
        <div className="loading">載入中...</div>
      </div>
    );
  }

  return (
    <div className="order-success-page">
      <div className="success-container">
        <div className="success-icon">
          <CheckCircle size={80} color="#10b981" />
        </div>

        <h1 className="success-title">訂單已成功送出!</h1>
        <p className="success-message">
          感謝您的購買,我們已收到您的訂單,將盡快為您處理
        </p>

        {orderDetail && (
          <div className="order-info-card">
            <div className="info-row">
              <span className="info-label">訂單編號</span>
              <span className="info-value order-no">{orderDetail.order_no}</span>
            </div>

            <div className="info-row">
              <span className="info-label">訂單金額</span>
              <span className="info-value total">NT$ {orderDetail.total.toLocaleString()}</span>
            </div>

            <div className="info-row">
              <span className="info-label">付款方式</span>
              <span className="info-value">{getPaymentMethodText(orderDetail.payment_method)}</span>
            </div>

            <div className="info-row">
              <span className="info-label">配送方式</span>
              <span className="info-value">{getShippingMethodText(orderDetail.shipping_method)}</span>
            </div>

            <div className="info-row">
              <span className="info-label">訂單時間</span>
              <span className="info-value">
                {new Date(orderDetail.created_at).toLocaleString('zh-TW')}
              </span>
            </div>
          </div>
        )}

        <div className="next-steps">
          <h3 className="steps-title">接下來...</h3>
          <ul className="steps-list">
           {orderDetail?.payment_method === 'cod' ? (
              <>
                <li>我們會盡快將商品送至您選擇的門市</li>
                <li>商品到店後,您會收到簡訊通知</li>
                <li>請在期限內前往門市取貨並付款</li>
              </>
            ) : orderDetail?.payment_method === 'Credit' ? (
              <>
                <li>付款成功後,我們會立即處理您的訂單</li>
                <li>商品將盡快為您配送</li>
                <li>您可以在「我的訂單」中查看配送進度</li>
              </>
            ) : (
              <>
                <li>請在期限內完成付款</li>
                <li>完成付款後,我們會立即處理您的訂單</li>
                <li>您可以在「我的訂單」中查看付款資訊</li>
              </>
            )}
          </ul>
        </div>

        <div className="action-buttons">
          <button className="btn-orders" onClick={() => navigate('/checkout/orders')}>
            <Package size={20} />
            查看我的訂單
          </button>
          <button className="btn-home" onClick={() => navigate('/')}>
            <Home size={20} />
            返回首頁
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccessPage;