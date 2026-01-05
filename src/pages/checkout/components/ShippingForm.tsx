// src/pages/checkout/components/ShippingForm.tsx
import React, { useState, useEffect } from 'react';
import { Store, Truck, CreditCard, MapPin, Banknote } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import './styles/ShippingForm.css';


interface ShippingInfo {
  name: string;
  phone: string;
  email: string;
  address?: string;
  storeId?: string;
  storeName?: string;
  storeAddress?: string;
}

interface CvsStoreHistory {
  store_id: string;
  store_name: string;
  store_address: string;
  cvs_type: string;
  used_at: string;
}

interface ShippingFormProps {
  currentStep: number;
  shippingInfo: ShippingInfo;
  setShippingInfo: React.Dispatch<React.SetStateAction<ShippingInfo>>;
  shippingMethod: string;
  setShippingMethod: (method: string) => void;
  shippingSubType: string;
  setShippingSubType: (subType: string) => void;
  paymentMethod: string;
  setPaymentMethod: (method: string) => void;
  invoiceType: string;
  setInvoiceType: (type: string) => void;
  companyName: string;
  setCompanyName: (name: string) => void;
  taxId: string;
  setTaxId: (id: string) => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onSubmitOrder: () => void;
}

const ShippingForm: React.FC<ShippingFormProps> = ({
  currentStep,
  shippingInfo,
  setShippingInfo,
  shippingMethod,
  setShippingMethod,
  shippingSubType,
  setShippingSubType,
  paymentMethod,
  setPaymentMethod,
  invoiceType,
  setInvoiceType,
  companyName,
  setCompanyName,
  taxId,
  setTaxId,
  onNextStep,
  onPrevStep,
  onSubmitOrder,
}) => {
  // 處理收件資訊變更
  const handleInfoChange = (field: string, value: string) => {
    setShippingInfo(prev => ({ ...prev, [field]: value }));
  };

  // 自取門市列表
  const [pickupStores, setPickupStores] = useState<any[]>([]);
  const [selectedPickupStore, setSelectedPickupStore] = useState<any>(null);

  const [homeDeliveryFee, setHomeDeliveryFee] = useState<number>(100);

  // ✅ [新增] 歷史門市列表 State
  const [cvsStoreHistory, setCvsStoreHistory] = useState<CvsStoreHistory[]>([]);

  // ✅ [新增] 載入歷史門市 (當選擇超商類型時觸發)
  useEffect(() => {
    const fetchCvsHistory = async () => {
      if (shippingMethod !== 'cvs' || !shippingSubType) {
        setCvsStoreHistory([]);
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        // 注意：使用完整網址
        const res = await fetch(`https://www.anxinshophub.com/api/members/cvs-stores?type=${shippingSubType}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setCvsStoreHistory(data.stores);
        }
      } catch (error) {
        console.error('載入歷史門市失敗:', error);
      }
    };

    fetchCvsHistory();
  }, [shippingMethod, shippingSubType]);

  // ✅ [新增] 儲存門市到歷史記錄的函式
  const saveCvsStoreToHistory = async (storeId: string, storeName: string, storeAddress: string) => {
    const token = localStorage.getItem('token');
    // 這裡需要依賴最新的 shippingSubType，所以稍後 useEffect 要加入依賴
    if (!token || !shippingSubType) return;

    try {
      await fetch('https://www.anxinshophub.com/api/members/cvs-stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          cvs_type: shippingSubType,
          store_id: storeId,
          store_name: storeName,
          store_address: storeAddress
        })
      });
      // (選擇性) 可以在這裡重新 fetchCvsHistory 以更新列表，或是等待下次渲染
    } catch (error) {
      console.error('儲存門市失敗:', error);
    }
  };

  console.log('🔥🔥🔥 這是最新版 V2.0 🔥🔥🔥');
  useEffect(() => {
    const fetchShippingFee = async () => {
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
    fetchShippingFee();
  }, []);

  // 載入自取門市
  useEffect(() => {
    const fetchPickupStores = async () => {
      try {
        const res = await fetch('https://www.anxinshophub.com/api/pickup-stores');
        const data = await res.json();
        if (data.success) {
          setPickupStores(data.stores);
        }
      } catch (error) {
        console.error('載入門市失敗:', error);
      }
    };
    fetchPickupStores();
  }, []);

  // ==========================================
  // [修正版] 監聽綠界地圖回傳
  // ==========================================
  useEffect(() => {
    const handleStoreData = (data: { storeId?: string; storeName?: string; storeAddress?: string }) => {
      if (data && data.storeId) {
        console.log('收到門市資料:', data);
        
        setTimeout(() => {
          setShippingInfo(prev => ({
            ...prev,
            storeId: data.storeId,
            storeName: data.storeName,
            storeAddress: data.storeAddress
          }));

          // ✅ [新增] 同步儲存到歷史紀錄
          if (data.storeId && data.storeName && data.storeAddress) {
             saveCvsStoreToHistory(data.storeId, data.storeName, data.storeAddress);
          }
        }, 100);
      }
    };
    
    // ... (原本的 postMessage 和 AppUrlOpen 監聽器程式碼完全不用動) ...
    const handleEcpayMessage = (event: MessageEvent) => { handleStoreData(event.data); };
    window.addEventListener('message', handleEcpayMessage);
    
    let appUrlListener: any = null;
    if (Capacitor.isNativePlatform()) {
       // ... (保留您原本的 App 監聽程式碼) ...
    }

    return () => {
      window.removeEventListener('message', handleEcpayMessage);
      if (appUrlListener) {
        appUrlListener.remove();
      }
    };
    // ✅ [重要] 依賴列表要補上 shippingSubType (為了存檔用)
  }, [setShippingInfo, shippingSubType]);

  // 選擇超商門市 (開啟綠界地圖)
  // 選擇超商門市 (開啟綠界地圖)
  const handleSelectStore = async () => {
    if (!shippingSubType) {
      alert('請先選擇超商類型 (7-11/全家/萊爾富/OK)');
      return;
    }

    try {
      // 判斷是否在 App 環境
      const isApp = Capacitor.isNativePlatform();

      if (isApp) {
        // ==========================================
        // [修改] App 環境：直接開啟後端做好的中繼頁面
        // ==========================================
        // 這樣可以解決 Android 不支援 GET 參數的問題
        // 請確保您的後端已經部署了新的 /map-page 路由
        const bridgeUrl = `https://www.anxinshophub.com/api/ecpay/map-page?logisticsSubType=${shippingSubType}`;
        
        console.log('App 開啟地圖頁面:', bridgeUrl);
        
        await Browser.open({ 
          url: bridgeUrl,
          windowName: '_self', // 建議設定，讓體驗更像原生跳轉
          presentationStyle: 'fullscreen'
        });

      } else {
        // ==========================================
        // 網頁環境：維持原本邏輯 (完全不動)
        // ==========================================
        const response = await fetch(`https://www.anxinshophub.com/api/ecpay/map?logisticsSubType=${shippingSubType}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const params = await response.json();

        const width = 800;
        const height = 600;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        
        const mapWindow = window.open(
          '', 
          'ECPayMapPopup',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );

        if (!mapWindow) {
          alert('瀏覽器阻擋了彈跳視窗，請允許本網站顯示視窗後再試一次。');
          return;
        }

        mapWindow.document.write('<h3 style="text-align:center; margin-top: 100px;">正在連線至物流地圖...</h3>');

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = params.actionUrl;
        form.target = 'ECPayMapPopup';

        Object.keys(params).forEach(key => {
          if (key !== 'actionUrl') {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = params[key];
            form.appendChild(input);
          }
        });

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
      }

    } catch (error: any) {
      console.error('開啟門市地圖失敗:', error);
      alert(`開啟門市地圖失敗，請稍後再試: ${error.message || ''}`);
    }
  };

  return (
    <>
      {/* 步驟 1: 收件資訊 */}
      {currentStep === 1 && (
        <div className="form-section">
          <h2 className="section-title">收件資訊</h2>
          
          <div className="form-group">
            <label className="form-label">收件人姓名 *</label>
            <input
              type="text"
              className="form-input"
              placeholder="請輸入姓名"
              value={shippingInfo.name}
              onChange={(e) => handleInfoChange('name', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">手機號碼 *</label>
            <input
              type="tel"
              className="form-input"
              placeholder="09XXXXXXXX"
              value={shippingInfo.phone}
              onChange={(e) => handleInfoChange('phone', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email *</label>
            <input
              type="email"
              className="form-input"
              placeholder="example@email.com"
              value={shippingInfo.email}
              onChange={(e) => handleInfoChange('email', e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button className="btn-next" onClick={onNextStep}>
              下一步
            </button>
          </div>
        </div>
      )}

      {/* 步驟 2: 配送方式 */}
      {currentStep === 2 && (
        <div className="form-section">
          <h2 className="section-title">配送方式</h2>

          {/* 配送方式選擇 */}
          <div className="shipping-methods">
            <div
              className={`shipping-option ${shippingMethod === 'cvs' ? 'selected' : ''}`}
              onClick={() => setShippingMethod('cvs')}
            >
              <input
                type="radio"
                name="shipping"
                checked={shippingMethod === 'cvs'}
                readOnly
              />
              <Store size={24} />
              <div className="option-info">
                <div className="option-title">超商取貨</div>
                <div className="option-desc">3-5個工作天送達門市</div>
              </div>
              <div className="option-price">NT$ 60</div>
            </div>

            {/* 門市自取 */}
            <div
              className={`shipping-option ${shippingMethod === 'pickup' ? 'selected' : ''}`}
              onClick={() => {
                setShippingMethod('pickup');
                setSelectedPickupStore(null);
              }}
            >
              <input
                type="radio"
                name="shipping"
                checked={shippingMethod === 'pickup'}
                readOnly
              />
              <MapPin size={24} />
              <div className="option-info">
                <div className="option-title">門市自取</div>
                <div className="option-desc">親臨門市取貨</div>
              </div>
              <div className="option-price free">免運費</div>
            </div>

            <div
              className={`shipping-option ${shippingMethod === 'home' ? 'selected' : ''}`}
              onClick={() => setShippingMethod('home')}
            >
              <input
                type="radio"
                name="shipping"
                checked={shippingMethod === 'home'}
                readOnly
              />
              <Truck size={24} />
              <div className="option-info">
                <div className="option-title">宅配到府</div>
                <div className="option-desc">2-3個工作天送達</div>
              </div>
              <div className="option-price">NT$ {homeDeliveryFee}</div>
            </div>
          </div>

          {/* 門市自取選擇 */}
          {shippingMethod === 'pickup' && (
            <div className="pickup-store-selection">
              <label className="form-label">選擇自取門市 *</label>
              {pickupStores.length === 0 ? (
                <p className="no-stores">目前沒有可選擇的門市</p>
              ) : (
                <div className="pickup-store-list">
                  {pickupStores.map((store) => (
                    <div
                      key={store.id}
                      className={`pickup-store-option ${selectedPickupStore?.id === store.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedPickupStore(store);
                        handleInfoChange('storeId', `pickup-${store.id}`);
                        handleInfoChange('storeName', store.name);
                        handleInfoChange('storeAddress', store.address);
                      }}
                    >
                      <div className="store-radio">
                        <input
                          type="radio"
                          name="pickupStore"
                          checked={selectedPickupStore?.id === store.id}
                          readOnly
                        />
                      </div>
                      <div className="store-details">
                        <div className="store-name">{store.name}</div>
                        <div className="store-address">{store.address}</div>
                        {store.phone && <div className="store-phone">📞 {store.phone}</div>}
                        {store.business_hours && <div className="store-hours">🕐 {store.business_hours}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 超商選擇 */}
          {shippingMethod === 'cvs' && (
            <div className="cvs-selection">
              <label className="form-label">選擇超商 *</label>
              <div className="cvs-options">
                <button
                  className={`cvs-btn ${shippingSubType === 'UNIMARTC2C' ? 'selected' : ''}`}
                  onClick={() => setShippingSubType('UNIMARTC2C')}
                >
                  7-ELEVEN
                </button>
                <button
                  className={`cvs-btn ${shippingSubType === 'FAMIC2C' ? 'selected' : ''}`}
                  onClick={() => setShippingSubType('FAMIC2C')}
                >
                  全家
                </button>
                <button
                  className={`cvs-btn ${shippingSubType === 'HILIFEC2C' ? 'selected' : ''}`}
                  onClick={() => setShippingSubType('HILIFEC2C')}
                >
                  萊爾富
                </button>
                <button
                  className={`cvs-btn ${shippingSubType === 'OKMARTC2C' ? 'selected' : ''}`}
                  onClick={() => setShippingSubType('OKMARTC2C')}
                >
                  OK超商
                </button>
              </div>

{/* ✅ [新增] 歷史門市列表區塊 */}
              {shippingSubType && cvsStoreHistory.length > 0 && (
                <div className="cvs-history">
                  <label className="form-label">📍 最近使用的門市</label>
                  <div className="cvs-history-list">
                    {cvsStoreHistory.map((store) => (
                      <div
                        key={store.store_id}
                        className={`cvs-history-item ${shippingInfo.storeId === store.store_id ? 'selected' : ''}`}
                        onClick={() => {
                          setShippingInfo(prev => ({
                            ...prev,
                            storeId: store.store_id,
                            storeName: store.store_name,
                            storeAddress: store.store_address
                          }));
                        }}
                      >
                        <div className="history-radio">
                          <input
                            type="radio"
                            name="cvsHistory"
                            checked={shippingInfo.storeId === store.store_id}
                            readOnly
                          />
                        </div>
                        <div className="history-details">
                          <div className="history-store-name">{store.store_name}</div>
                          <div className="history-store-address">{store.store_address}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* ✅ [新增結束] */}

              {shippingSubType && (
                <div className="store-selector">
                  <button type="button" className="select-store-btn" onClick={handleSelectStore}>
                    <MapPin size={20} />
                    {shippingInfo.storeId ? '變更門市' : '選擇門市'}
                  </button>
                  {shippingInfo.storeId && (
                    <div className="selected-store">
                      <div className="store-name">{shippingInfo.storeName}</div>
                      <div className="store-address">{shippingInfo.storeAddress}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 宅配地址 */}
          {shippingMethod === 'home' && (
            <div className="form-group">
              <label className="form-label">收件地址 *</label>
              <input
                type="text"
                className="form-input"
                placeholder="請輸入完整地址 (含縣市、區域、街道、門牌號碼)"
                value={shippingInfo.address || ''}
                onChange={(e) => handleInfoChange('address', e.target.value)}
              />
            </div>
          )}

          <div className="form-actions">
            <button className="btn-prev" onClick={onPrevStep}>
              上一步
            </button>
            <button className="btn-next" onClick={onNextStep}>
              下一步
            </button>
          </div>
        </div>
      )}

      {/* 步驟 3: 付款方式 */}
      {currentStep === 3 && (
        <div className="form-section">
          <h2 className="section-title">付款方式</h2>

          <div className="payment-methods">
            {/* 超商取貨付款 - 只有超商取貨才顯示 */}
            {shippingMethod === 'cvs' && (
              <div
                className={`payment-option ${paymentMethod === 'cod' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('cod')}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'cod'}
                  readOnly
                />
                <Store size={24} />
                <div className="option-info">
                  <div className="option-title">超商取貨付款</div>
                  <div className="option-desc">取貨時付現金</div>
                </div>
              </div>
            )}

            {/* 到店付款 - 只有門市自取才顯示 */}
            {shippingMethod === 'pickup' && (
              <div
                className={`payment-option ${paymentMethod === 'store_pay' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('store_pay')}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'store_pay'}
                  readOnly
                />
                <Store size={24} />
                <div className="option-info">
                  <div className="option-title">到店付款</div>
                  <div className="option-desc">親臨門市時付款（現金或刷卡）</div>
                </div>
              </div>
            )}

            {/* [新增] 宅配貨到付款 - 只有宅配才顯示 */}
            {shippingMethod === 'home' && (
              <div
                className={`payment-option ${paymentMethod === 'cod' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('cod')}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'cod'}
                  readOnly
                />
                <Banknote size={24} />
                <div className="option-info">
                  <div className="option-title">宅配貨到付款</div>
                  <div className="option-desc">商品送達時支付現金</div>
                </div>
              </div>
            )}

            {/* 線上付款方式 - 只有 "非自取" 且 "非宅配" 才顯示 */}
            {shippingMethod !== 'pickup' && shippingMethod !== 'home' && (
              <>
                <div
                  className={`payment-option ${paymentMethod === 'Credit' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('Credit')}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'Credit'}
                    readOnly
                  />
                  <CreditCard size={24} />
                  <div className="option-info">
                    <div className="option-title">信用卡</div>
                    <div className="option-desc">Visa, MasterCard, JCB</div>
                  </div>
                </div>

                <div
                  className={`payment-option ${paymentMethod === 'ATM' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('ATM')}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'ATM'}
                    readOnly
                  />
                  <div className="payment-icon">ATM</div>
                  <div className="option-info">
                    <div className="option-title">ATM 虛擬帳號</div>
                    <div className="option-desc">取得繳費帳號後轉帳</div>
                  </div>
                </div>

                <div
                  className={`payment-option ${paymentMethod === 'CVS' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('CVS')}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'CVS'}
                    readOnly
                  />
                  <Store size={24} />
                  <div className="option-info">
                    <div className="option-title">超商代碼繳費</div>
                    <div className="option-desc">取得繳費代碼後至超商繳費</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 發票資訊 */}
          <div className="invoice-section">
            <h3 className="subsection-title">發票資訊</h3>
            
            <div className="invoice-types">
              <label className="radio-label">
                <input
                  type="radio"
                  name="invoice"
                  checked={invoiceType === 'personal'}
                  onChange={() => setInvoiceType('personal')}
                />
                個人電子發票
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="invoice"
                  checked={invoiceType === 'company'}
                  onChange={() => setInvoiceType('company')}
                />
                公司戶發票
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="invoice"
                  checked={invoiceType === 'donate'}
                  onChange={() => setInvoiceType('donate')}
                />
                捐贈發票
              </label>
            </div>

            {invoiceType === 'company' && (
              <div className="company-invoice">
                <div className="form-group">
                  <label className="form-label">公司抬頭 *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="請輸入公司名稱"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">統一編號 *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="請輸入8位數統編"
                    maxLength={8}
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button className="btn-prev" onClick={onPrevStep}>
              上一步
            </button>
            <button className="btn-next" onClick={onNextStep}>
              下一步
            </button>
          </div>
        </div>
      )}

      {/* 步驟 4: 確認訂單 */}
      {currentStep === 4 && (
        <div className="form-section">
          <h2 className="section-title">確認訂單</h2>

          <div className="order-confirm">
            <div className="confirm-section">
              <h3 className="confirm-title">收件資訊</h3>
              <div className="confirm-content">
                <p><strong>姓名:</strong> {shippingInfo.name}</p>
                <p><strong>電話:</strong> {shippingInfo.phone}</p>
                <p><strong>Email:</strong> {shippingInfo.email}</p>
              </div>
            </div>

            <div className="confirm-section">
              <h3 className="confirm-title">配送方式</h3>
              <div className="confirm-content">
                {shippingMethod === 'pickup' ? (
                  <>
                    <p><strong>配送方式:</strong> 門市自取</p>
                    <p><strong>門市:</strong> {shippingInfo.storeName}</p>
                    <p><strong>地址:</strong> {shippingInfo.storeAddress}</p>
                  </>
                ) : shippingMethod === 'cvs' ? (
                  <>
                    <p><strong>配送方式:</strong> 超商取貨</p>
                    <p><strong>超商:</strong> {
                      shippingSubType === 'UNIMARTC2C' ? '7-ELEVEN' :
                      shippingSubType === 'FAMIC2C' ? '全家' :
                      shippingSubType === 'HILIFEC2C' ? '萊爾富' :
                      shippingSubType === 'OKMARTC2C' ? 'OK超商' : ''
                    }</p>
                    <p><strong>門市:</strong> {shippingInfo.storeName}</p>
                    <p><strong>地址:</strong> {shippingInfo.storeAddress}</p>
                  </>
                ) : (
                  <>
                    <p><strong>配送方式:</strong> 宅配到府</p>
                    <p><strong>地址:</strong> {shippingInfo.address}</p>
                  </>
                )}
              </div>
            </div>

            <div className="confirm-section">
              <h3 className="confirm-title">付款方式</h3>
              <div className="confirm-content">
                <p>
                  {paymentMethod === 'cod' && (shippingMethod === 'home' ? '宅配貨到付款' : '超商取貨付款')}
                  {paymentMethod === 'store_pay' && '到店付款'}
                  {paymentMethod === 'Credit' && '信用卡'}
                  {paymentMethod === 'ATM' && 'ATM 虛擬帳號'}
                  {paymentMethod === 'CVS' && '超商代碼繳費'}
                </p>
              </div>
            </div>

            <div className="confirm-section">
              <h3 className="confirm-title">發票資訊</h3>
              <div className="confirm-content">
                {invoiceType === 'personal' && <p>個人電子發票</p>}
                {invoiceType === 'company' && (
                  <>
                    <p><strong>公司抬頭:</strong> {companyName}</p>
                    <p><strong>統一編號:</strong> {taxId}</p>
                  </>
                )}
                {invoiceType === 'donate' && <p>捐贈發票</p>}
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn-prev" onClick={onPrevStep}>
              上一步
            </button>
            <button className="btn-submit" onClick={onSubmitOrder}>
              確認送出訂單
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ShippingForm;