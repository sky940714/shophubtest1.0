// LoginPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Lock, Mail, User } from 'lucide-react';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  // 移除 isAdminMode，只保留註冊模式切換
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  
  // 表單狀態
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    confirmPassword: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // 統一登入邏輯：單一入口，自動分流
  const handleLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    try {
      const response = await fetch('https://www.anxinshophub.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (data.success) {
        // 1. 儲存 Token (這是最重要的憑證)
        localStorage.setItem('token', data.token);
        
        // 2. 儲存基本資訊供前端顯示
        localStorage.setItem('userEmail', data.user.email);
        localStorage.setItem('userName', data.user.name);
        localStorage.setItem('userId', data.user.id);

        // 3. 關鍵邏輯：檢查身分並分流
        if (data.user.role === 'admin') {
          // 如果是管理員
          localStorage.setItem('isAdmin', 'true'); // 前端標記
          alert('管理員登入成功！進入後台系統');
          navigate('/admin'); // 導向後台
        } else {
          // 如果是一般會員
          localStorage.removeItem('isAdmin'); // 清除管理員標記
          localStorage.setItem('isLoggedIn', 'true');
          alert(`登入成功！歡迎 ${data.user.name}`);
          navigate('/'); // 導向首頁
        }
      } else {
        alert(data.message || '帳號或密碼錯誤！');
      }
    } catch (error) {
      console.error('登入錯誤：', error);
      alert('登入失敗，請檢查網路連線或稍後再試');
    }
  };

  const handleRegister = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    // 驗證
    if (formData.password !== formData.confirmPassword) {
      alert('密碼不一致！');
      return;
    }

    if (formData.password.length < 6) {
      alert('密碼至少需要6個字元！');
      return;
    }

    // 呼叫後端註冊 API
    try {
      const response = await fetch('https://www.anxinshophub.com/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone 
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('註冊成功！即將為您登入...');
        
        // 註冊成功後自動登入
        localStorage.setItem('token', data.token);
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userEmail', data.user.email);
        localStorage.setItem('userName', data.user.name);
        localStorage.setItem('userId', data.user.id);
        
        navigate('/');
      } else {
        alert(data.message || '註冊失敗');
      }
    } catch (error) {
      console.error('註冊錯誤：', error);
      alert('註冊失敗，請檢查網路連線或稍後再試');
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* 左側 - 品牌資訊 */}
        <div className="login-brand">
          <div className="brand-content">
            <ShoppingCart className="brand-icon" />
            <h1 className="brand-title">安鑫購物</h1>
            <p className="brand-subtitle">精選商品，品質保證，快速配送</p>
            <div className="brand-features">
              <div className="feature-item">
                <div className="feature-icon">✓</div>
                <span>正品保證</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">✓</div>
                <span>24小時快速出貨</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">✓</div>
                <span>7天鑑賞期</span>
              </div>
            </div>
          </div>
        </div>

        {/* 右側 - 登入表單 */}
        <div className="login-form-container">
          <div className="login-form-wrapper">
            
            {/* 移除原本的 mode-switch 按鈕區塊 */}

            <div className="form-header">
              <h2 className="form-title">
                {isRegisterMode ? '會員註冊' : '會員登入'}
              </h2>
              <p className="form-description">
                {isRegisterMode 
                  ? '建立您的帳號，開始購物體驗' 
                  : '歡迎回來！請登入您的帳號'}
              </p>
            </div>

            <form onSubmit={isRegisterMode ? handleRegister : handleLogin} className="login-form">
              {/* 註冊模式才顯示姓名 */}
              {isRegisterMode && (
                <div className="form-group">
                  <label className="form-label">
                    <User className="label-icon" />
                    姓名
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="請輸入您的姓名"
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  <Mail className="label-icon" />
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="請輸入您的 Email"
                  required
                />
              </div>

              {isRegisterMode && (
                <div className="form-group">
                  <label className="form-label">
                    <User className="label-icon" />
                    電話
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="請輸入您的電話號碼"
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  <Lock className="label-icon" />
                  密碼
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="請輸入密碼"
                  required
                />
              </div>

              {/* 註冊模式才顯示確認密碼 */}
              {isRegisterMode && (
                <div className="form-group">
                  <label className="form-label">
                    <Lock className="label-icon" />
                    確認密碼
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="請再次輸入密碼"
                    required
                  />
                </div>
              )}

              {!isRegisterMode && (
                <div className="form-options">
                  <label className="remember-me">
                    <input type="checkbox" />
                    <span>記住我</span>
                  </label>
                  <a href="#" className="forgot-password">忘記密碼？</a>
                </div>
              )}

              <button type="submit" className="submit-btn">
                {isRegisterMode ? '註冊帳號' : '登入'}
              </button>

              <div className="form-footer">
                {isRegisterMode ? (
                  <p>
                    已有帳號？
                    <button
                      type="button"
                      className="switch-mode-btn"
                      onClick={() => {
                        setIsRegisterMode(false);
                        setFormData({ email: '', password: '', name: '', confirmPassword: '' , phone: '' });
                      }}
                    >
                      立即登入
                    </button>
                  </p>
                ) : (
                  <p>
                    還沒有帳號？
                    <button
                      type="button"
                      className="switch-mode-btn"
                      onClick={() => {
                        setIsRegisterMode(true);
                        setFormData({ email: '', password: '', name: '', confirmPassword: '' ,phone: ''});
                      }}
                    >
                      立即註冊
                    </button>
                  </p>
                )}
              </div>

              {/* 已經移除原本的 admin-hint 提示區塊 */}
            </form>

            <button 
              className="back-home-btn"
              onClick={() => navigate('/')}
            >
              ← 返回首頁
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;