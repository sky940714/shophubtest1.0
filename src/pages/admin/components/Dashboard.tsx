// pages/admin/components/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { Package, ShoppingCart, Users, BarChart3 } from 'lucide-react';
import '../styles/Dashboard.css';

interface Stats {
  totalProducts: number;
  totalOrders: number;
  totalMembers: number;
  totalRevenue: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    totalOrders: 0,
    totalMembers: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('請先登入');
        return;
      }

      const response = await fetch('https://www.anxinshophub.com/api/orders/admin/dashboard/stats', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('取得統計資料失敗');
      }

      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
      } else {
        setError(data.message || '取得統計資料失敗');
      }

    } catch (error) {
      console.error('取得統計資料錯誤:', error);
      setError('無法載入統計資料，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>載入中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>
          <p>{error}</p>
          <button 
            onClick={fetchDashboardData}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            重新載入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <h2 className="dashboard-title">數據總覽</h2>

      {/* 統計卡片 */}
      <div className="stats-grid">
        <div className="stat-card stat-blue">
          <div className="stat-content">
            <div className="stat-info">
              <p className="stat-label">總商品數</p>
              <p className="stat-value">{stats.totalProducts}</p>
            </div>
            <Package className="stat-icon" />
          </div>
        </div>

        <div className="stat-card stat-purple">
          <div className="stat-content">
            <div className="stat-info">
              <p className="stat-label">總訂單數</p>
              <p className="stat-value">{stats.totalOrders}</p>
            </div>
            <ShoppingCart className="stat-icon" />
          </div>
        </div>

        <div className="stat-card stat-green">
          <div className="stat-content">
            <div className="stat-info">
              <p className="stat-label">總會員數</p>
              <p className="stat-value">{stats.totalMembers}</p>
            </div>
            <Users className="stat-icon" />
          </div>
        </div>

        <div className="stat-card stat-orange">
          <div className="stat-content">
            <div className="stat-info">
              <p className="stat-label">總營業額</p>
              <p className="stat-value">NT$ {stats.totalRevenue.toLocaleString()}</p>
            </div>
            <BarChart3 className="stat-icon" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;