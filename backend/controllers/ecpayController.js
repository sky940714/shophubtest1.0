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
// 3. 取得地圖參數 (物流 - 去程)
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
// 4. 地圖選完後的回調 (物流 - 回程)
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

    // 回傳 HTML，嘗試兩種方式：Deep Link 和 postMessage
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>門市選擇完成</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px 20px; }
    .success { color: #22c55e; font-size: 48px; }
    .message { margin: 20px 0; color: #333; }
    .redirect { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="success">✓</div>
  <div class="message">門市選擇完成</div>
  <div class="redirect">正在返回 App...</div>
  
  <script>
    const storeData = {
      storeId: '${CVSStoreID || ''}',
      storeName: '${CVSStoreName || ''}',
      storeAddress: '${CVSAddress || ''}',
      logisticsSubType: '${LogisticsSubType || ''}'
    };

    // 方法 1: 嘗試 Deep Link (App 環境)
    const deepLink = 'shophubapp://map-callback?${params.toString()}';
    
    // 方法 2: postMessage (網頁環境)
    if (window.opener) {
      window.opener.postMessage(storeData, '*');
      setTimeout(() => window.close(), 500);
    } else {
      // App 環境，使用 Deep Link
      window.location.href = deepLink;
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
// 5. 產生寄貨單 (物流 - 產生編號) - 🔥 重大修正區
// ==========================================
const createShippingOrder = async (req, res) => {
  try {
    const { orderNo } = req.body;

    // 1. 撈取訂單
    const [rows] = await promisePool.execute('SELECT * FROM orders WHERE order_no = ?', [orderNo]);
    if (rows.length === 0) return res.status(404).json({ error: '無此訂單' });
    
    const order = rows[0];

    // 2. 檢查是否已經產生過
    if (order.ecpay_payment_no) {
      return res.status(400).json({ error: '此訂單已產生過寄貨編號' });
    }

    // 強制轉 C2C
    let subType = order.shipping_sub_type || '';
    if (subType === 'UNIMART') subType = 'UNIMARTC2C';
    if (subType === 'FAMI') subType = 'FAMIC2C';
    if (subType === 'HILIFE') subType = 'HILIFEC2C';
    if (subType === 'OKMART') subType = 'OKMARTC2C';
    order.shipping_sub_type = subType;

    console.log(`正在建立物流訂單: ${orderNo}, 類型: ${subType}`);

    // 3. 呼叫 Utils 產生參數
    const params = ecpayUtils.getLogisticsCreateParams(order);
    const logisticsUrl = ecpayUtils.getApiUrl('create');
    
    // 4. 發送請求給綠界
    const response = await axios.post(logisticsUrl, qs.stringify(params), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const resultText = response.data;
    console.log('綠界物流 API 回傳:', resultText);

    // 5. 解析回傳結果
    if (String(resultText).startsWith('1|')) {
      const resultParams = new URLSearchParams(resultText.split('|')[1]);
      const AllPayLogisticsID = resultParams.get('AllPayLogisticsID');
      const CVSPaymentNo = resultParams.get('CVSPaymentNo'); // 寄貨編號
      const CVSValidationNo = resultParams.get('CVSValidationNo'); // 🔥 新增抓取驗證碼

      // 6. 更新資料庫 (🔥 寫入 ecpay_validation_no)
      await promisePool.execute(
        `UPDATE orders SET ecpay_logistics_id = ?, ecpay_payment_no = ?, ecpay_validation_no = ?, status = 'shipped', updated_at = NOW() WHERE order_no = ?`,
        [AllPayLogisticsID, CVSPaymentNo, CVSValidationNo, orderNo]
      );

      res.json({ success: true, AllPayLogisticsID, CVSPaymentNo });
    } else {
      // 解析綠界錯誤訊息
      let errorMessage = '綠界建立失敗';
      
      if (resultText.includes('餘額為負數') || resultText.includes('不足支付')) {
        errorMessage = '綠界帳戶餘額不足，請先至綠界後台儲值';
      } else if (resultText.includes('重複')) {
        errorMessage = '此訂單已建立過物流單';
      } else if (resultText.includes('門市')) {
        errorMessage = '超商門市資訊有誤，請確認門市代碼';
      } else {
        // 提取括號內的訊息
        const match = resultText.match(/\(([^)]+)\)/);
        if (match) {
          errorMessage = match[1];
        }
      }
      
      res.status(400).json({ 
        success: false, 
        error: errorMessage, 
        details: resultText 
      });
    }
  } catch (error) {
    console.error('建立物流單失敗:', error);
    res.status(500).json({ error: '建立物流訂單失敗' });
  }
};

// ==========================================
// 6. 列印託運單 (物流 - 列印) - 🔥 重大修正區
// ==========================================
const printShippingLabel = async (req, res) => {
  try {
    const { orderNo } = req.query;

    // 🔥 修改查詢：必須多撈取 payment_no, validation_no 和 shipping_sub_type
    const [rows] = await promisePool.execute(
      'SELECT ecpay_logistics_id, ecpay_payment_no, ecpay_validation_no, shipping_sub_type FROM orders WHERE order_no = ?', 
      [orderNo]
    );

    if (rows.length === 0 || !rows[0].ecpay_logistics_id) {
      return res.send('<h2>錯誤：此訂單尚未產生寄貨編號，請先執行「建立物流單」</h2>');
    }

    const orderData = rows[0];
    
    // 🔍 【除錯追蹤】
    console.log('============== 列印除錯開始 ==============');
    console.log('1. 訂單編號:', orderNo);
    console.log('2. 物流 ID:', orderData.ecpay_logistics_id);
    console.log('3. 寄貨編號:', orderData.ecpay_payment_no);
    console.log('4. 驗證碼:', orderData.ecpay_validation_no);
    console.log('5. 物流類型:', orderData.shipping_sub_type);
    console.log('==========================================');

    // 🔥 傳送完整資料給 Utils
    const html = ecpayUtils.getPrintHtml({
        AllPayLogisticsID: orderData.ecpay_logistics_id,
        LogisticsSubType: orderData.shipping_sub_type || 'UNIMARTC2C', // 預設 C2C
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
    
    // 3001, 3002, 3003: 賣家已到門市寄貨 -> 設為 'shipped' (已出貨)
    if (['3001', '3002', '3003', '3024', '2001'].includes(code)) {
      newStatus = 'shipped'; 
    } 
    // 2030: 商品已送達門市 -> 設為 'arrived' (已送達)
    else if (code === '2030') {
      newStatus = 'arrived';
    } 
    // 2067: 消費者成功取件 -> 設為 'completed' (已完成)
    else if (code === '2067') {
      newStatus = 'completed'; 
    } 
    // 2063, 2068, 2073: 門市退貨/未取 -> 設為 'returned' (退貨)
    else if (['2063', '2068', '2073'].includes(code)) {
      newStatus = 'returned'; 
    }

    // 更新資料庫
    if (newStatus) {
      const [result] = await promisePool.execute(
        `UPDATE orders SET status = ?, updated_at = NOW() WHERE ecpay_logistics_id = ?`,
        [newStatus, AllPayLogisticsID]
      );
      if (result.affectedRows > 0) {
        console.log(`✅ 訂單狀態更新為: ${newStatus} (物流編號: ${AllPayLogisticsID})`);
      }
    }

    res.send('1|OK');
  } catch (error) {
    console.error('❌ 物流回調失敗:', error);
    res.send('1|OK');
  }
};

// ==========================================
// 新增：產生金流付款頁面（給 App 用）
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

    // 產生自動提交的 HTML 表單
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

module.exports = {
  createPayment,
  handleCallback,
  getMapParams,
  handleMapCallback,
  createShippingOrder,
  printShippingLabel,
  handleLogisticsCallback,
  getPaymentPage  // ← 新增這行
};