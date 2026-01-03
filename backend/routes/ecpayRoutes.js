// backend/routes/ecpayRoutes.js
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
router.get('/map', ecpayController.getMapParams); // 網頁版取得參數
router.post('/map-callback', ecpayController.handleMapCallback); // 網頁版回調

// --- App 專用 ---
router.get('/map-page', ecpayController.renderMapPage); // App 開啟的中繼頁
router.post('/map-app-redirect', ecpayController.handleAppMapRedirect); // [新增] App 地圖回程轉址

// ==========================================
// 3. 後台出貨相關
// ==========================================
router.post('/create-shipping', ecpayController.createShippingOrder); // 產生寄貨單
router.get('/print-shipping', ecpayController.printShippingLabel);   // 列印託運單
router.post('/logistics-callback', ecpayController.handleLogisticsCallback); // 物流狀態更新

// App 專用金流頁面
router.get('/pay/:orderId', ecpayController.getPaymentPage);

module.exports = router;