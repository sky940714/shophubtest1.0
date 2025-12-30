    // src/pages/checkout/CheckoutPage.tsx
    import React, { useState, useEffect } from 'react';
    import { useNavigate, useLocation } from 'react-router-dom';
    import { useCart } from '../../context/CartContext';
    import { ArrowLeft } from 'lucide-react';
    import StepIndicator from './components/StepIndicator';
    import ShippingForm from './components/ShippingForm';
    import OrderSummary from './components/OrderSummary';
    import './styles/CheckoutPage.css';
    import ECPayForm from './components/ECPayForm';

    interface ShippingInfo {
    name: string;
    phone: string;
    email: string;
    address?: string;
    storeId?: string;
    storeName?: string;
    storeAddress?: string;
    }

    const CheckoutPage: React.FC = () => {
     const navigate = useNavigate();
     const location = useLocation();
     const { cartItems, clearCart } = useCart();
     const [ecpayParams, setEcpayParams] = useState<any>(null);
     const [homeDeliveryFee, setHomeDeliveryFee] = useState<number>(100);

    // 檢查是否為立即購買模式
    const directBuyState = location.state as { directBuy?: boolean; items?: any[] };
    const isDirectBuy = directBuyState?.directBuy || false;
    
    // 決定使用哪個商品列表
    const checkoutItems = isDirectBuy ? (directBuyState.items || []) : cartItems;

    // 步驟控制
    const [currentStep, setCurrentStep] = useState(1);

    // 收件資訊
    const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
        name: '',
        phone: '',
        email: '',
    });

    // 配送方式
    const [shippingMethod, setShippingMethod] = useState<string>('');
    const [shippingSubType, setShippingSubType] = useState<string>('');

    // 付款方式
    const [paymentMethod, setPaymentMethod] = useState<string>('');

    // 發票資訊
    const [invoiceType, setInvoiceType] = useState<string>('personal');
    const [companyName, setCompanyName] = useState<string>('');
    const [taxId, setTaxId] = useState<string>('');

    // 計算金額
    const subtotal = checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shippingFee = getShippingFee();
    const total = subtotal + shippingFee;

    // 取得運費
    function getShippingFee(): number {
    if (!shippingMethod) return 0;
    if (shippingMethod === 'pickup') return 0;
    
    // 超商取貨：滿 500 免運
    if (shippingMethod === 'cvs') {
        return subtotal >= 500 ? 0 : 60;
    }
    
    if (shippingMethod === 'home') {
    return subtotal >= 1000 ? 0 : homeDeliveryFee;
}
    
    return 0;
}

    // 監聽綠界門市選擇回傳
    useEffect(() => {
      const fetchFee = async () => {
        try {
          const res = await fetch('https://www.anxinshophub.com/api/settings/shipping-fee');
          const data = await res.json();
          if (data.success) {
            setHomeDeliveryFee(data.fee);
          }
        } catch (error) {
          console.error('載入運費失敗:', error);
        }
      };
      fetchFee();
    }, []);

    // 載入會員資料和預設地址
    useEffect(() => {
      const fetchDefaultInfo = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
          // 取得會員資料（Email）
          const profileRes = await fetch('https://www.anxinshophub.com/api/members/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const profileData = await profileRes.json();

          // 取得預設地址
          const addressRes = await fetch('https://www.anxinshophub.com/api/members/addresses/default', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const addressData = await addressRes.json();

          // 帶入表單
          if (profileData.success || addressData.success) {
            setShippingInfo(prev => ({
              ...prev,
              email: profileData.member?.email || prev.email,
              name: addressData.address?.recipient_name || prev.name,
              phone: addressData.address?.phone || prev.phone,
              address: addressData.address?.full_address || prev.address
            }));
          }
        } catch (error) {
          console.error('載入預設資訊失敗:', error);
        }
      };

      fetchDefaultInfo();
    }, []);

    // 如果沒有要結帳的商品
    useEffect(() => {
    if (checkoutItems.length === 0) {
        navigate('/', { replace: true });
    }
    }, [checkoutItems.length, navigate]);

    // 驗證步驟
    const validateStep = (step: number): boolean => {
        if (step === 1) {
        if (!shippingInfo.name || !shippingInfo.phone || !shippingInfo.email) {
            alert('請填寫完整收件資訊');
            return false;
        }
        const phoneRegex = /^09\d{8}$/;
        if (!phoneRegex.test(shippingInfo.phone)) {
            alert('請輸入正確的手機號碼格式 (例: 0912345678)');
            return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(shippingInfo.email)) {
            alert('請輸入正確的 Email 格式');
            return false;
        }
        }

        if (step === 2) {
        if (!shippingMethod) {
            alert('請選擇配送方式');
            return false;
        }
        // 門市自取驗證
        if (shippingMethod === 'pickup' && !shippingInfo.storeId) {
            alert('請選擇自取門市');
            return false;
        }
        if (shippingMethod === 'cvs' && !shippingSubType) {
            alert('請選擇超商');
            return false;
        }
        if (shippingMethod === 'cvs' && !shippingInfo.storeId) {
            alert('請選擇取貨門市');
            return false;
        }
        if (shippingMethod === 'home' && !shippingInfo.address) {
            alert('請填寫收件地址');
            return false;
        }
        }

        if (step === 3) {
        if (!paymentMethod) {
            alert('請選擇付款方式');
            return false;
        }
        if (invoiceType === 'company' && (!companyName || !taxId)) {
            alert('請填寫公司抬頭和統一編號');
            return false;
        }
        }

        return true;
    };

    // 下一步
    const handleNextStep = () => {
        if (validateStep(currentStep)) {
        setCurrentStep(currentStep + 1);
        }
    };

    // 上一步
    const handlePrevStep = () => {
        setCurrentStep(currentStep - 1);
    };

    // 提交訂單
    const handleSubmitOrder = async () => {
        if (!validateStep(3)) return;

        try {
        const token = localStorage.getItem('token');
        
        const orderData = {
            shippingInfo,
            shippingMethod,
            shippingSubType,
            paymentMethod,
            invoiceType,
            companyName,
            taxId,
            subtotal,
            shippingFee,
            total,
            items: checkoutItems.map(item => ({
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            name: item.name,
            image_url: item.image_url,
            variant_name: item.variant_name || null,
            price: item.price,
            quantity: item.quantity,
            cart_item_id: item.cart_item_id
    }))
        };

        const response = await fetch('https://www.anxinshophub.com/api/orders/create', {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(orderData),
        });

        // ... 前面 fetch 程式碼 ...
    const data = await response.json();

    if (data.success) {
      // 只有從購物車來的才清空購物車
      if (!isDirectBuy) {
        clearCart();
      }

      // 如果是線上付款 (信用卡/ATM等)
        if (paymentMethod !== 'cod' && paymentMethod !== 'store_pay') {
        // 將後端回傳的參數存入 state
        if (data.ecpayParams) {
           setEcpayParams(data.ecpayParams);
        } else {
           alert('無法取得付款資訊');
        }
      } else {
        // 取貨付款直接完成
        navigate(`/checkout/order-success/${data.orderNo}`);
      }
    } else { 
      // 【修正】這裡直接接 else，不要有多餘的 "}"
      alert(data.message || '建立訂單失敗');
    } // <--- 這裡才是 try 區塊的結尾

  } catch (error) {
    console.error('建立訂單失敗:', error);
    alert('建立訂單失敗,請稍後再試');
  }
};

    return (
        <div className="checkout-page">
        {/* 返回按鈕 */}
       <button className="back-button" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
            返回購物車
        </button>

        {/* 步驟指示器 */}
        <StepIndicator currentStep={currentStep} />

        <div className="checkout-content">
            {/* 左側:表單區域 */}
            <div className="checkout-form">
            <ShippingForm
                currentStep={currentStep}
                shippingInfo={shippingInfo}
                setShippingInfo={setShippingInfo}
                shippingMethod={shippingMethod}
                setShippingMethod={setShippingMethod}
                shippingSubType={shippingSubType}
                setShippingSubType={setShippingSubType}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                invoiceType={invoiceType}
                setInvoiceType={setInvoiceType}
                companyName={companyName}
                setCompanyName={setCompanyName}
                taxId={taxId}
                setTaxId={setTaxId}
                onNextStep={handleNextStep}
                onPrevStep={handlePrevStep}
                onSubmitOrder={handleSubmitOrder}
            />
            </div>

            {/* 右側:訂單摘要 */}
            <OrderSummary
            cartItems={checkoutItems}
            subtotal={subtotal}
            shippingFee={shippingFee}
            total={total}
            shippingMethod={shippingMethod}
            />
        </div>

        {/* 新增：隱藏的綠界表單，當 ecpayParams 有值時會自動 Submit */}
            <ECPayForm params={ecpayParams} />

        </div>
    );
    };

    export default CheckoutPage;