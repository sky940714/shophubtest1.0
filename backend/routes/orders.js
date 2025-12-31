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

    // 1. 取得運費設定
    let homeDeliveryFee = 100; // 預設值
    const [feeSettings] = await connection.query(
      `SELECT setting_value FROM settings WHERE setting_key = 'home_delivery_fee'`
    );
    if (feeSettings.length > 0) {
      homeDeliveryFee = parseInt(feeSettings[0].setting_value) || 100;
    }

    // 2. 計算運費函數
    function calculateShippingFee(method, subtotal, homeFee) {
      if (!method || method === 'pickup') return 0;
      if (method === 'cvs') return subtotal >= 500 ? 0 : 60;
      if (method === 'home') return subtotal >= 1000 ? 0 : homeFee;
      return 0;
    }

    const shippingFee = calculateShippingFee(shippingMethod, subtotal, homeDeliveryFee);
    const total = subtotal + shippingFee;

    // 3. 產生訂單編號 (格式: ORD20251209001)
    const orderNo = await generateOrderNo(connection);

    // 4. 插入訂單主表
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

    // 5. 插入訂單明細 並 扣除庫存 (防超賣邏輯)
    for (const item of items) {
      // 5-1. 插入明細
      await connection.query(`
        INSERT INTO order_items (
          order_id, product_id, variant_id,
          product_name, product_image, variant_name,
          price, quantity, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderId,
        item.product_id,
        item.variant_id || null,
        item.name,
        item.image_url || null,
        item.variant_name || null,
        item.price,
        item.quantity,
        item.price * item.quantity
      ]);

      // 5-2. 扣減庫存 (加入 AND stock >= ? 防止超賣)
      if (item.variant_id) {
        // 如果有規格
        const [result] = await connection.query(`
          UPDATE product_variants 
          SET stock = stock - ? 
          WHERE id = ? AND stock >= ?
        `, [item.quantity, item.variant_id, item.quantity]);

        if (result.affectedRows === 0) {
            throw new Error(`商品 ${item.name} (${item.variant_name}) 庫存不足`);
        }
      } else {
        // 如果沒有規格 (主商品)
        const [result] = await connection.query(`
          UPDATE products 
          SET stock = stock - ? 
          WHERE id = ? AND stock >= ?
        `, [item.quantity, item.product_id, item.quantity]);

        if (result.affectedRows === 0) {
            throw new Error(`商品 ${item.name} 庫存不足`);
        }
      }
    }

    // 6. 如果是從購物車來的, 清空購物車
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

    // 7. 準備綠界參數 (如果不是貨到付款)
    let ecpayParams = null;
    if (paymentMethod !== 'cod') {
      const orderData = {
        order_no: orderNo,
        total: total,
        created_at: new Date()
      };
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
    // 分頁參數
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    // 搜尋和篩選參數
    const search = req.query.search || '';
    const status = req.query.status || '';
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (search) {
      whereClause += ' AND (o.order_no LIKE ? OR o.receiver_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (status && status !== 'all') {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }
    
    const [countResult] = await promisePool.query(
      `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
      params
    );
    const total = countResult[0].total;

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
    
    await connection.query(`
      UPDATE orders SET status = ? WHERE order_no = ?
    `, [status, orderNo]);

    // ✅ 完成訂單加點數
    if (status === 'completed' && oldStatus !== 'completed') {
      const points = Math.floor(order.subtotal / 100);
      if (points > 0) {
        await connection.query(`
          UPDATE members SET points = points + ? WHERE id = ?
        `, [points, order.user_id]);
        
        await connection.query(`
          INSERT INTO point_transactions (member_id, order_no, points, type, description)
          VALUES (?, ?, ?, 'earn', ?)
        `, [order.user_id, orderNo, points, `訂單完成獲得 ${points} 點`]);
      }
    }

    // ✅ 取消訂單扣點數
    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      const [earnedPoints] = await connection.query(`
        SELECT COALESCE(SUM(points), 0) as total_earned 
        FROM point_transactions 
        WHERE order_no = ? AND type = 'earn'
      `, [orderNo]);
      
      const pointsToDeduct = earnedPoints[0].total_earned || 0;
      
      if (pointsToDeduct > 0) {
        const [memberInfo] = await connection.query(`
          SELECT points FROM members WHERE id = ?
        `, [order.user_id]);
        
        const currentPoints = memberInfo[0]?.points || 0;
        const actualDeduct = Math.min(pointsToDeduct, currentPoints);
        
        if (actualDeduct > 0) {
          await connection.query(`
            UPDATE members SET points = points - ? WHERE id = ?
          `, [actualDeduct, order.user_id]);
          
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
    const [productCount] = await promisePool.query(`SELECT COUNT(*) as total FROM products`);
    const [orderCount] = await promisePool.query(`SELECT COUNT(*) as total FROM orders`);
    const [memberCount] = await promisePool.query(`SELECT COUNT(*) as total FROM members`);
    const [revenue] = await promisePool.query(`SELECT SUM(total) as total FROM orders WHERE status != 'cancelled'`);

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
  
  await connection.query(`
    INSERT INTO order_sequences (date, last_number)
    VALUES (?, 1)
    ON DUPLICATE KEY UPDATE last_number = last_number + 1
  `, [todayDate]);

  const [result] = await connection.query(`
    SELECT last_number FROM order_sequences WHERE date = ?
  `, [todayDate]);

  const orderNo = `ORD${dateStr}${String(result[0].last_number).padStart(3, '0')}`;

  return orderNo;
}

// ========================================
// 8. 會員自行取消訂單 (需歸還庫存)
// PUT /api/orders/:orderNo/cancel
// ========================================
router.put('/:orderNo/cancel', protect, async (req, res) => {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { orderNo } = req.params;
    const userId = req.user.id;

    // 1. 查詢訂單
    const [orders] = await connection.query(`
      SELECT id, status, payment_status 
      FROM orders 
      WHERE order_no = ? AND user_id = ?
    `, [orderNo, userId]);

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '找不到訂單' });
    }
    const order = orders[0];

    // 2. 只有 "待付款" 或 "待出貨" 可以取消
    if (order.status !== 'pending' && order.status !== 'paid') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: '訂單已進入出貨流程，無法取消' });
    }

    // 3. 歸還庫存
    const [items] = await connection.query('SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?', [order.id]);
    for (const item of items) {
      if (item.variant_id) {
        await connection.query('UPDATE product_variants SET stock = stock + ? WHERE id = ?', [item.quantity, item.variant_id]);
      } else {
        await connection.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
      }
    }

    // 4. 更新狀態
    await connection.query("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?", [order.id]);
    
    await connection.commit();
    res.json({ success: true, message: '訂單已成功取消' });

  } catch (error) {
    await connection.rollback();
    console.error('取消失敗:', error);
    res.status(500).json({ success: false, message: '系統錯誤' });
  } finally {
    connection.release();
  }
});

module.exports = router;