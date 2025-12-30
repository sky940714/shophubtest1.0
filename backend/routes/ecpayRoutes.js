const express = require('express');
const router = express.Router();
const ecpayController = require('../controllers/ecpayController');

// ==========================================
// 1. 金流相關 (消費者付款)
// ==========================================
router.post('/checkout', ecpayController.createPayment);
router.post('/callback', ecpayController.handleCallback);

// ==========================================
// 2. 物流地圖相關 (消費者選門市)
// ==========================================
router.get('/map', ecpayController.getMapParams);
router.post('/map-callback', ecpayController.handleMapCallback);

// ==========================================
// 3. [關鍵修正] 後台出貨相關 (你漏掉的!)
// ==========================================
// 這兩行一定要加，不然會出現 404 錯誤
router.post('/create-shipping', ecpayController.createShippingOrder); // 產生寄貨單
router.get('/print-shipping', ecpayController.printShippingLabel);   // 列印託運單

router.post('/logistics-callback', ecpayController.handleLogisticsCallback);

// 新增這行
router.get('/pay/:orderId', ecpayController.getPaymentPage);

module.exports = router;