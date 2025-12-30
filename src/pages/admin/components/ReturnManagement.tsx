// src/pages/admin/components/ReturnManagement.tsx
import React, { useState, useEffect } from 'react';
import '../styles/OrderManagement.css'; // 共用訂單管理的樣式

interface ReturnRequest {
  id: number;
  order_no: string;
  user_name: string;
  user_email: string;
  reason: string;
  bank_code: string;
  bank_account: string;
  status: 'pending' | 'approved' | 'rejected' | 'refunded';
  created_at: string;
  order_total: number;
}

const ReturnManagement: React.FC = () => {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // 載入退貨列表
  const fetchReturns = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch('https://www.anxinshophub.com/api/returns/admin/list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setReturns(data.returns);
      }
    } catch (error) {
      console.error('載入失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  // 更新狀態 (審核/退款)
  const handleUpdateStatus = async (id: number, newStatus: string, confirmMsg: string) => {
    if (!window.confirm(confirmMsg)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`https://www.anxinshophub.com/api/returns/admin/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        alert('操作成功');
        fetchReturns(); // 重整列表
      } else {
        alert('操作失敗: ' + data.message);
      }
    } catch (error) {
      console.error(error);
      alert('系統錯誤');
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, {text: string, color: string}> = {
      pending: { text: '待審核', color: '#ff9800' },
      approved: { text: '已核准 (待退貨)', color: '#2196f3' },
      refunded: { text: '已退款 (結案)', color: '#4caf50' },
      rejected: { text: '已拒絕', color: '#f44336' }
    };
    const s = map[status] || { text: status, color: '#999' };
    return <span style={{ padding: '4px 8px', borderRadius: '4px', color: 'white', backgroundColor: s.color, fontSize: '12px' }}>{s.text}</span>;
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  return (
    <div className="order-management">
      <h2 className="page-title">退貨申請管理</h2>

      <div className="content-card">
        {loading ? <div className="loading">載入中...</div> : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>申請時間</th>
                  <th>訂單編號</th>
                  <th>會員姓名</th>
                  <th>退貨原因</th>
                  <th>退款帳戶</th>
                  <th>狀態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {returns.length === 0 ? (
                  <tr><td colSpan={7} className="no-data">目前沒有退貨申請</td></tr>
                ) : (
                  returns.map(r => (
                    <tr key={r.id}>
                      <td>{new Date(r.created_at).toLocaleDateString()}</td>
                      <td>{r.order_no} <br/><small style={{color:'#666'}}>${r.order_total}</small></td>
                      <td>{r.user_name}</td>
                      <td style={{maxWidth:'200px'}}>{r.reason}</td>
                      <td>
                        <div style={{fontSize:'13px'}}>
                          銀行: {r.bank_code}<br/>
                          帳號: {r.bank_account}
                        </div>
                      </td>
                      <td>{getStatusBadge(r.status)}</td>
                      <td className="actions">
                        {r.status === 'pending' && (
                          <>
                            <button 
                              className="btn-detail" 
                              style={{backgroundColor: '#28a745', marginRight: '5px'}}
                              onClick={() => handleUpdateStatus(r.id, 'approved', '確定同意退貨嗎？請通知客戶寄回商品。')}
                            >
                              同意退貨
                            </button>
                            <button 
                              className="btn-delete"
                              onClick={() => handleUpdateStatus(r.id, 'rejected', '確定拒絕此退貨申請嗎？訂單將恢復為已完成。')}
                            >
                              拒絕
                            </button>
                          </>
                        )}
                        
                        {r.status === 'approved' && (
                          <button 
                            className="btn-detail"
                            style={{backgroundColor: '#17a2b8'}}
                            onClick={() => handleUpdateStatus(r.id, 'refunded', '確認已收到商品且已轉帳退款？此操作將結案。')}
                          >
                            確認已退款 (結案)
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReturnManagement;