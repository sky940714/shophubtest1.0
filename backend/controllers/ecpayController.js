// backend/controllers/ecpayController.js
const { promisePool } = require('../config/database'); 
const ecpayUtils = require('../utils/ecpay');
const axios = require('axios');
const qs = require('qs');

// ==========================================
// 1. 產生綠界付款資料 (金流 - 前往結帳)
// ==========================================
const createPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: '缺少訂單 ID' });

    const [rows] = await promisePool.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (rows.length === 0) return res.status(404).json({ error: '找不到訂單' });

    const order = rows[0];
    const paymentParams = ecpayUtils.getParams(order);
    res.json(paymentParams);
  } catch (error) {
    console.error('建立綠界訂單失敗:', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
};

// ==========================================
// 2. 接收綠界背景通知 (金流 - Webhook)
// ==========================================
const handleCallback = async (req, res) => {
  try {
    const ecpayData = req.body;
    console.log('收到綠界回調:', ecpayData);

    const isValid = ecpayUtils.verifyCheckMacValue(ecpayData);
    if (!isValid) return res.send('0|ErrorMessage');

    if (ecpayData.RtnCode === '1') {
      const orderNo = ecpayData.MerchantTradeNo;
      const tradeNo = ecpayData.TradeNo;
      await promisePool.execute(
        `UPDATE orders SET payment_status = 'paid', status = 'paid', ecpay_trade_no = ?, updated_at = NOW() WHERE order_no = ?`,
        [tradeNo, orderNo]
      );
      res.send('1|OK');
    } else {
      res.send('1|OK');
    }
  } catch (error) {
    console.error('處理綠界回調錯誤:', error);
    res.status(500).send('Error');
  }
};

// ==========================================
// 3. 取得地圖參數 (物流 - 去程 - 網頁版用)
// ==========================================
const getMapParams = (req, res) => {
  try {
    const { logisticsSubType } = req.query;
    const params = ecpayUtils.getMapParams(logisticsSubType);
    res.json(params);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '取得地圖參數失敗' });
  }
};

// ==========================================
// 4. 地圖選完後的回調 (物流 - 回程 - 網頁版用)
// ==========================================
const handleMapCallback = (req, res) => {
  try {
    const { CVSStoreID, CVSStoreName, CVSAddress, LogisticsSubType } = req.body;
    
    // 編碼參數（處理中文）
    const params = new URLSearchParams({
      storeId: CVSStoreID || '',
      storeName: CVSStoreName || '',
      storeAddress: CVSAddress || '',
      logisticsSubType: LogisticsSubType || ''
    });

    // 回傳 HTML (網頁版使用 postMessage 機制)
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>門市選擇完成</title>
</head>
<body>
  <script>
    const storeData = {
      storeId: '${CVSStoreID || ''}',
      storeName: '${CVSStoreName || ''}',
      storeAddress: '${CVSAddress || ''}',
      logisticsSubType: '${LogisticsSubType || ''}'
    };

    if (window.opener) {
      window.opener.postMessage(storeData, '*');
      setTimeout(() => window.close(), 500);
    } else {
      document.write('已選擇門市，請關閉視窗');
    }
  </script>
</body>
</html>`;
    
    res.send(html);
  } catch (error) {
    console.error('處理門市回調失敗:', error);
    res.send('<h2>處理門市資料失敗，請重試</h2>');
  }
};

// ==========================================
// 5. 產生寄貨單 (物流 - 產生編號)
// ==========================================
const createShippingOrder = async (req, res) => {
  try {
    const { orderNo } = req.body;

    const [rows] = await promisePool.execute('SELECT * FROM orders WHERE order_no = ?', [orderNo]);
    if (rows.length === 0) return res.status(404).json({ error: '無此訂單' });
    
    const order = rows[0];

    if (order.ecpay_payment_no) {
      return res.status(400).json({ error: '此訂單已產生過寄貨編號' });
    }

    let subType = order.shipping_sub_type || '';
    if (subType === 'UNIMART') subType = 'UNIMARTC2C';
    if (subType === 'FAMI') subType = 'FAMIC2C';
    if (subType === 'HILIFE') subType = 'HILIFEC2C';
    if (subType === 'OKMART') subType = 'OKMARTC2C';
    order.shipping_sub_type = subType;

    console.log(`正在建立物流訂單: ${orderNo}, 類型: ${subType}`);

    const params = ecpayUtils.getLogisticsCreateParams(order);
    const logisticsUrl = ecpayUtils.getApiUrl('create');
    
    const response = await axios.post(logisticsUrl, qs.stringify(params), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const resultText = response.data;
    console.log('綠界物流 API 回傳:', resultText);

    if (String(resultText).startsWith('1|')) {
      const resultParams = new URLSearchParams(resultText.split('|')[1]);
      const AllPayLogisticsID = resultParams.get('AllPayLogisticsID');
      const CVSPaymentNo = resultParams.get('CVSPaymentNo'); 
      const CVSValidationNo = resultParams.get('CVSValidationNo');

      await promisePool.execute(
        `UPDATE orders SET ecpay_logistics_id = ?, ecpay_payment_no = ?, ecpay_validation_no = ?, status = 'shipped', updated_at = NOW() WHERE order_no = ?`,
        [AllPayLogisticsID, CVSPaymentNo, CVSValidationNo, orderNo]
      );

      res.json({ success: true, AllPayLogisticsID, CVSPaymentNo });
    } else {
      let errorMessage = '綠界建立失敗';
      if (resultText.includes('餘額為負數') || resultText.includes('不足支付')) {
        errorMessage = '綠界帳戶餘額不足，請先至綠界後台儲值';
      } else if (resultText.includes('重複')) {
        errorMessage = '此訂單已建立過物流單';
      } else if (resultText.includes('門市')) {
        errorMessage = '超商門市資訊有誤，請確認門市代碼';
      } else {
        const match = resultText.match(/\(([^)]+)\)/);
        if (match) errorMessage = match[1];
      }
      res.status(400).json({ success: false, error: errorMessage, details: resultText });
    }
  } catch (error) {
    console.error('建立物流單失敗:', error);
    res.status(500).json({ error: '建立物流訂單失敗' });
  }
};

// ==========================================
// 6. 列印託運單 (物流 - 列印)
// ==========================================
const printShippingLabel = async (req, res) => {
  try {
    const { orderNo } = req.query;

    const [rows] = await promisePool.execute(
      'SELECT ecpay_logistics_id, ecpay_payment_no, ecpay_validation_no, shipping_sub_type FROM orders WHERE order_no = ?', 
      [orderNo]
    );

    if (rows.length === 0 || !rows[0].ecpay_logistics_id) {
      return res.send('<h2>錯誤：此訂單尚未產生寄貨編號，請先執行「建立物流單」</h2>');
    }

    const orderData = rows[0];
    const html = ecpayUtils.getPrintHtml({
        AllPayLogisticsID: orderData.ecpay_logistics_id,
        LogisticsSubType: orderData.shipping_sub_type || 'UNIMARTC2C', 
        CVSPaymentNo: orderData.ecpay_payment_no,
        CVSValidationNo: orderData.ecpay_validation_no
    });
    
    res.send(html);

  } catch (error) {
    console.error(error);
    res.send('列印發生錯誤');
  }
};

// ==========================================
// 7. 接收物流狀態回調 (自動更新訂單狀態)
// ==========================================
const handleLogisticsCallback = async (req, res) => {
  try {
    const logisticsData = req.body;
    console.log('📦 收到綠界物流回調:', logisticsData);

    const { AllPayLogisticsID, RtnCode } = logisticsData;
    let newStatus = null;
    const code = String(RtnCode);
    
    if (['3001', '3002', '3003', '3024', '2001'].includes(code)) {
      newStatus = 'shipped'; 
    } else if (code === '2030') {
      newStatus = 'arrived';
    } else if (code === '2067') {
      newStatus = 'completed'; 
    } else if (['2063', '2068', '2073'].includes(code)) {
      newStatus = 'returned'; 
    }

    if (newStatus) {
      const [result] = await promisePool.execute(
        `UPDATE orders SET status = ?, updated_at = NOW() WHERE ecpay_logistics_id = ?`,
        [newStatus, AllPayLogisticsID]
      );
    }
    res.send('1|OK');
  } catch (error) {
    console.error('❌ 物流回調失敗:', error);
    res.send('1|OK');
  }
};

// ==========================================
// 8. 產生金流付款頁面（給 App 用）
// ==========================================
const getPaymentPage = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const [rows] = await promisePool.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (rows.length === 0) {
      return res.send('<h2>找不到訂單</h2>');
    }

    const order = rows[0];
    const params = ecpayUtils.getParams(order);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>前往付款...</title>
  <style>
    body { font-family: -apple-system, sans-serif; text-align: center; padding: 50px; }
    .loading { font-size: 18px; color: #333; }
  </style>
</head>
<body>
  <div class="loading">正在前往綠界付款頁面...</div>
  <form id="ecpayForm" method="POST" action="${params.actionUrl}">
    ${Object.keys(params).filter(k => k !== 'actionUrl').map(k => 
      `<input type="hidden" name="${k}" value="${params[k]}" />`
    ).join('')}
  </form>
  <script>document.getElementById('ecpayForm').submit();</script>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    console.error('產生付款頁面失敗:', error);
    res.send('<h2>產生付款頁面失敗</h2>');
  }
};

// ==========================================
// 9. [修正] 產生綠界地圖跳轉頁面 (給 App 用)
// ==========================================
const renderMapPage = (req, res) => {
  try {
    const { logisticsSubType } = req.query;
    
    // 取得綠界所需的參數
    const params = ecpayUtils.getMapParams(logisticsSubType);
    
    // 🔥 [關鍵修正] 設定回傳網址為 App 專用的轉址路由
    // 這會告訴綠界：選完後請 POST 到這個網址，而不是預設的網頁版 callback
    params.ClientReplyURL = "https://www.anxinshophub.com/api/ecpay/map-app-redirect";

    const actionUrl = params.actionUrl;
    delete params.actionUrl;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>正在前往門市地圖...</title>
  <style>
    body { font-family: -apple-system, sans-serif; text-align: center; padding: 50px; }
    .loading { font-size: 18px; color: #333; }
  </style>
</head>
<body>
  <div class="loading">正在前往門市選擇頁面...</div>
  <form id="ecpayMapForm" method="POST" action="${actionUrl}">
    ${Object.keys(params).map(k => 
      `<input type="hidden" name="${k}" value="${params[k]}" />`
    ).join('')}
  </form>
  <script>
    document.getElementById('ecpayMapForm').submit();
  </script>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    console.error('產生地圖頁面失敗:', error);
    res.send('<h2>無法開啟地圖頁面，請稍後再試</h2>');
  }
};

// ==========================================
// 10. [新增] 處理 App 地圖回傳 (轉址回 App)
// ==========================================
const handleAppMapRedirect = (req, res) => {
  const { CVSStoreName, CVSStoreID, CVSAddress, LogisticsSubType } = req.body;
  
  console.log('收到 App 地圖回傳，準備喚醒 App:', CVSStoreName);

  // 1. 處理中文編碼
  const storeName = encodeURIComponent(CVSStoreName || '');
  const address = encodeURIComponent(CVSAddress || '');
  
  // 2. 組合 App 專用網址 (Deep Link)
  // 格式: shophubapp://map-result?storeId=...
  const appUrl = `shophubapp://map-result?storeId=${CVSStoreID}&storeName=${storeName}&address=${address}&subtype=${LogisticsSubType}`;

  // 3. 回傳 HTML 讓瀏覽器執行跳轉
  const html = `
    <!DOCTYPE html>
    <html>
    <body>
      <script>
        document.body.innerHTML = "<h3>正在返回 App...</h3>";
        // 喚醒 App
        window.location.href = "${appUrl}";
        
        // 延遲關閉視窗
        setTimeout(function() { window.close(); }, 1500);
      </script>
    </body>
    </html>
  `;
  res.send(html);
};

// ==========================================
// 統一匯出
// ==========================================
module.exports = {
  createPayment,
  handleCallback,
  getMapParams,
  handleMapCallback,
  createShippingOrder,
  printShippingLabel,
  handleLogisticsCallback,
  getPaymentPage,
  renderMapPage,
  handleAppMapRedirect // <--- 新增這個
};