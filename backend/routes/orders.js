// backend/routes/orders.js
const express = require('express');
const router = express.Router();
const { promisePool, query } = require('../config/database');
const { protect } = require('../middleware/auth');
const ecpayUtils = require('../utils/ecpay');

// ========================================
// 1. 建立訂單 (前台)
// POST /api/orders/create
// ========================================
router.post('/create', protect, async (req, res) => {
  const connection = await promisePool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const userId = req.user.id;
    // 修改後
    const {
      shippingInfo,
      shippingMethod,
      shippingSubType,
      paymentMethod,
      invoiceType,
      companyName,
      taxId,
      subtotal,
      items
    } = req.body;

    // 後端重新計算運費（安全性）
    // 從資料庫讀取宅配運費設定
let homeDeliveryFee = 100; // 預設值
const [feeSettings] = await connection.query(
  `SELECT setting_value FROM settings WHERE setting_key = 'home_delivery_fee'`
);
if (feeSettings.length > 0) {
  homeDeliveryFee = parseInt(feeSettings[0].setting_value) || 100;
}

// 計算運費
function calculateShippingFee(method, subtotal, homeFee) {
  if (!method || method === 'pickup') return 0;
  if (method === 'cvs') return subtotal >= 500 ? 0 : 60;
  if (method === 'home') return subtotal >= 1000 ? 0 : homeFee;
  return 0;
}

const shippingFee = calculateShippingFee(shippingMethod, subtotal, homeDeliveryFee);
const total = subtotal + shippingFee;

    // 產生訂單編號 (格式: ORD20251209001)
    const orderNo = await generateOrderNo(connection);

    // 插入訂單主表
    const [orderResult] = await connection.query(`
      INSERT INTO orders (
        order_no, user_id,
        receiver_name, receiver_phone, receiver_email, receiver_address,
        store_id, store_name, store_address,
        shipping_method, shipping_sub_type, shipping_fee,
        payment_method, payment_status,
        invoice_type, company_name, tax_id,
        subtotal, total, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderNo, userId,
      shippingInfo.name, shippingInfo.phone, shippingInfo.email, shippingInfo.address || null,
      shippingInfo.storeId || null, shippingInfo.storeName || null, shippingInfo.storeAddress || null,
      shippingMethod, shippingSubType || null, shippingFee,
      paymentMethod, 'unpaid',
      invoiceType, companyName || null, taxId || null,
      subtotal, total, 'pending'
    ]);

    const orderId = orderResult.insertId;

    // ✅ 修正：插入訂單明細（保存完整快照）
    for (const item of items) {
      await connection.query(`
        INSERT INTO order_items (
          order_id, product_id, variant_id,
          product_name, product_image, variant_name,
          price, quantity, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderId,
        item.product_id,
        item.variant_id || null,         // ✅ 修正：規格 ID
        item.name,                        // 商品名稱快照
        item.image_url || null,           // ✅ 修正：商品圖片快照
        item.variant_name || null,        // ✅ 修正：規格名稱快照
        item.price,
        item.quantity,
        item.price * item.quantity
      ]);

      // ✅ 修正：區分商品庫存和規格庫存
      if (item.variant_id) {
        // 如果有規格，扣減規格庫存
        await connection.query(`
          UPDATE product_variants 
          SET stock = stock - ? 
          WHERE id = ?
        `, [item.quantity, item.variant_id]);
      } else {
        // 如果沒有規格，扣減商品總庫存
        await connection.query(`
          UPDATE products 
          SET stock = stock - ? 
          WHERE id = ?
        `, [item.quantity, item.product_id]);
      }
    }

    // 如果是從購物車來的,清空購物車
    if (items[0] && items[0].cart_item_id) {
      const [carts] = await connection.query(`
        SELECT id FROM carts WHERE user_id = ?
      `, [userId]);
      
      if (carts.length > 0) {
        const cartId = carts[0].id;
        await connection.query(`
          DELETE FROM cart_items WHERE cart_id = ?
        `, [cartId]);
      }
    }

    await connection.commit();

    // 準備綠界參數 (如果不是貨到付款)
    let ecpayParams = null;
    if (paymentMethod !== 'cod') {
      // 構建傳給 utils 的物件，這裡只傳必要的，其他讓 utils 處理
      const orderData = {
        order_no: orderNo,
        total: total,
        created_at: new Date() // 傳入當下時間讓 utils 格式化
      };
      // 產生加密參數
      ecpayParams = ecpayUtils.getParams(orderData);
    }

    res.json({
      success: true,
      message: '訂單建立成功',
      orderNo: orderNo,
      ecpayParams: ecpayParams ? { ...ecpayParams, orderId: orderId } : null
    });

  } catch (error) {
    await connection.rollback();
    console.error('建立訂單失敗:', error);
    res.status(500).json({
      success: false,
      message: '建立訂單失敗',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// ========================================
// 2. 查詢單筆訂單 (前台)
// GET /api/orders/:orderNo
// ========================================
router.get('/:orderNo', protect, async (req, res) => {
  try {
    const { orderNo } = req.params;
    const userId = req.user.id;

    // 查詢訂單基本資料
    const [orders] = await promisePool.query(`
      SELECT * FROM orders 
      WHERE order_no = ? AND user_id = ?
    `, [orderNo, userId]);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到訂單'
      });
    }

    const order = orders[0];

    // 查詢訂單商品明細
    const [items] = await promisePool.query(`
      SELECT * FROM order_items WHERE order_id = ?
    `, [order.id]);

    res.json({
      success: true,
      order: {
        ...order,
        items: items
      }
    });

  } catch (error) {
    console.error('查詢訂單失敗:', error);
    res.status(500).json({
      success: false,
      message: '查詢訂單失敗'
    });
  }
});

// ========================================
// 3. 查詢會員的所有訂單 (前台)
// GET /api/orders/user/list
// ========================================
router.get('/user/list', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    // 查詢該會員的所有訂單
    const [orders] = await promisePool.query(`
      SELECT 
        id, order_no, total, status, payment_status,
        shipping_method, payment_method, created_at
      FROM orders 
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [userId]);

    res.json({
      success: true,
      orders: orders
    });

  } catch (error) {
    console.error('查詢訂單列表失敗:', error);
    res.status(500).json({
      success: false,
      message: '查詢訂單列表失敗'
    });
  }
});

// ========================================
// 4. 取得所有訂單 (後台 - 帶分頁、搜尋、篩選)
// GET /api/orders/admin/all
// ========================================
router.get('/admin/all', protect, async (req, res) => {
  try {
    // TODO: 檢查是否為管理員

    // 分頁參數
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    // 搜尋和篩選參數
    const search = req.query.search || '';
    const status = req.query.status || '';
    
    // 建立動態查詢條件
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    // 搜尋：訂單編號或客戶名稱
    if (search) {
      whereClause += ' AND (o.order_no LIKE ? OR o.receiver_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    // 篩選：訂單狀態
    if (status && status !== 'all') {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }
    
    // 查詢總筆數
    const [countResult] = await promisePool.query(
      `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // 查詢訂單列表
    const [orders] = await promisePool.query(`
      SELECT 
        o.id, o.order_no, o.receiver_name, o.total, 
        o.status, o.payment_status, o.created_at
      FROM orders o
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      success: true,
      orders: orders,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('查詢訂單失敗:', error);
    res.status(500).json({
      success: false,
      message: '查詢訂單失敗'
    });
  }
});

// ========================================
// 5. 取得訂單詳情 (後台)
// GET /api/orders/admin/:orderNo
// ========================================
router.get('/admin/:orderNo', protect, async (req, res) => {
  try {
    const { orderNo } = req.params;

    // 查詢訂單基本資料
    const [orders] = await promisePool.query(`
      SELECT o.*, m.email as user_email, m.name as user_name
      FROM orders o
      LEFT JOIN members m ON o.user_id = m.id
      WHERE o.order_no = ?
    `, [orderNo]);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到訂單'
      });
    }

    const order = orders[0];

    // 查詢訂單商品明細
    const [items] = await promisePool.query(`
      SELECT * FROM order_items WHERE order_id = ?
    `, [order.id]);

    res.json({
      success: true,
      order: {
        ...order,
        items: items
      }
    });

  } catch (error) {
    console.error('查詢訂單詳情失敗:', error);
    res.status(500).json({
      success: false,
      message: '查詢訂單詳情失敗'
    });
  }
});

// ========================================
// 6. 更新訂單狀態 (後台)
// PUT /api/orders/admin/:orderNo/status
// ========================================
router.put('/admin/:orderNo/status', protect, async (req, res) => {
  const connection = await promisePool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { orderNo } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: '無效的訂單狀態'
      });
    }

    // 查詢訂單資訊
    const [orders] = await connection.query(`
      SELECT id, user_id, subtotal, status FROM orders WHERE order_no = ?
    `, [orderNo]);
    
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到訂單'
      });
    }
    
    const order = orders[0];
    const oldStatus = order.status;
    
    // 更新訂單狀態
    await connection.query(`
      UPDATE orders SET status = ? WHERE order_no = ?
    `, [status, orderNo]);

    // ✅ 當狀態改為 completed 且之前不是 completed 時，自動加點數
    if (status === 'completed' && oldStatus !== 'completed') {
      // 計算點數：每100元1點（只算商品金額，不含運費）
      const points = Math.floor(order.subtotal / 100);
      
      if (points > 0) {
        // 更新會員點數
        await connection.query(`
          UPDATE members SET points = points + ? WHERE id = ?
        `, [points, order.user_id]);
        
        // 記錄點數交易
        await connection.query(`
          INSERT INTO point_transactions (member_id, order_no, points, type, description)
          VALUES (?, ?, ?, 'earn', ?)
        `, [order.user_id, orderNo, points, `訂單完成獲得 ${points} 點`]);
      }
    }

    // ✅ 當訂單取消時，扣回已發放的點數
    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      // 查詢該訂單曾發放的點數總和
      const [earnedPoints] = await connection.query(`
        SELECT COALESCE(SUM(points), 0) as total_earned 
        FROM point_transactions 
        WHERE order_no = ? AND type = 'earn'
      `, [orderNo]);
      
      const pointsToDeduct = earnedPoints[0].total_earned || 0;
      
      if (pointsToDeduct > 0) {
        // 查詢會員當前點數
        const [memberInfo] = await connection.query(`
          SELECT points FROM members WHERE id = ?
        `, [order.user_id]);
        
        const currentPoints = memberInfo[0]?.points || 0;
        // 實際扣除的點數（不能讓餘額變成負數）
        const actualDeduct = Math.min(pointsToDeduct, currentPoints);
        
        if (actualDeduct > 0) {
          // 扣回會員點數
          await connection.query(`
            UPDATE members SET points = points - ? WHERE id = ?
          `, [actualDeduct, order.user_id]);
          
          // 記錄點數扣回交易
          await connection.query(`
            INSERT INTO point_transactions (member_id, order_no, points, type, description)
            VALUES (?, ?, ?, 'deduct', ?)
          `, [order.user_id, orderNo, -actualDeduct, `訂單取消扣回 ${actualDeduct} 點`]);
        }
      }
    }
    
    await connection.commit();

    res.json({
      success: true,
      message: '訂單狀態更新成功'
    });

  } catch (error) {
    await connection.rollback();
    console.error('更新訂單狀態失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新訂單狀態失敗'
    });
  } finally {
    connection.release();
  }
});

// 7. 刪除訂單
router.delete('/admin/:orderNo', protect, async (req, res) => {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const { orderNo } = req.params;
    
    const [orders] = await connection.query('SELECT id FROM orders WHERE order_no = ?', [orderNo]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: '找不到訂單' });
    }
    
    const orderId = orders[0].id;
    await connection.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    await connection.query('DELETE FROM orders WHERE id = ?', [orderId]);
    await connection.commit();
    
    res.json({ success: true, message: '訂單已刪除' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: '刪除訂單失敗' });
  } finally {
    connection.release();
  }
});

// ========================================
// 7. 數據總覽統計 (後台)
// GET /api/orders/admin/dashboard/stats
// ========================================
router.get('/admin/dashboard/stats', protect, async (req, res) => {
  try {
    // 統計總商品數
    const [productCount] = await promisePool.query(`
      SELECT COUNT(*) as total FROM products
    `);

    // 統計總訂單數
    const [orderCount] = await promisePool.query(`
      SELECT COUNT(*) as total FROM orders
    `);

    // 統計總會員數
    const [memberCount] = await promisePool.query(`
      SELECT COUNT(*) as total FROM members
    `);

    // 統計總營業額 (排除已取消的訂單)
    const [revenue] = await promisePool.query(`
      SELECT SUM(total) as total FROM orders 
      WHERE status != 'cancelled'
    `);

    res.json({
      success: true,
      stats: {
        totalProducts: productCount[0].total,
        totalOrders: orderCount[0].total,
        totalMembers: memberCount[0].total,
        totalRevenue: revenue[0].total || 0
      }
    });

  } catch (error) {
    console.error('查詢統計資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '查詢統計資料失敗'
    });
  }
});

// ========================================
// 輔助函數: 產生訂單編號
// ========================================
async function generateOrderNo(connection) {
  const now = new Date();
  const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  const dateStr = taiwanTime.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const todayDate = taiwanTime.toISOString().slice(0, 10); // YYYY-MM-DD
  
  // 使用 INSERT ... ON DUPLICATE KEY UPDATE 確保原子操作
  await connection.query(`
    INSERT INTO order_sequences (date, last_number)
    VALUES (?, 1)
    ON DUPLICATE KEY UPDATE last_number = last_number + 1
  `, [todayDate]);

  // 取得更新後的流水號
  const [result] = await connection.query(`
    SELECT last_number FROM order_sequences WHERE date = ?
  `, [todayDate]);

  const orderNo = `ORD${dateStr}${String(result[0].last_number).padStart(3, '0')}`;

  return orderNo;
}

module.exports = router;