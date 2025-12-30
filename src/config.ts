// src/config.ts

// 這裡填入你的正式站網址 (注意結尾不要有斜線)
export const API_BASE_URL = 'https://www.anxinshophub.com';

/**
 * 圖片路徑處理工具
 * 如果圖片網址是 /uploads/xxx.jpg (相對路徑)，會自動加上網域變成 https://.../uploads/xxx.jpg
 * 如果已經是 https://... (絕對路徑)，則維持原狀
 */
export const getImageUrl = (path: string | null | undefined): string => {
  if (!path) return 'https://via.placeholder.com/400'; // 預設圖片
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // 確保路徑開頭有 /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};