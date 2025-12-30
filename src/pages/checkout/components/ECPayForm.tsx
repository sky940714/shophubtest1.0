import React, { useEffect } from 'react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

interface ECPayParams {
  actionUrl: string;
  orderId?: number;
  [key: string]: any;
}

const ECPayForm = ({ params }: { params: ECPayParams | null }) => {

  useEffect(() => {
    if (!params) return;

    const handlePayment = async () => {
      const isApp = Capacitor.isNativePlatform();

      if (isApp && params.orderId) {
        // === App 環境：用 Browser 插件開啟後端中繼頁面 ===
        console.log('App 環境，使用 Browser 插件跳轉...');
        await Browser.open({
          url: `https://www.anxinshophub.com/api/ecpay/pay/${params.orderId}`
        });
      } else {
        // === 網頁環境：傳統表單提交 ===
        console.log('網頁環境，使用表單提交...');
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = params.actionUrl;

        Object.keys(params).forEach(key => {
          if (key === 'actionUrl' || key === 'orderId') return;
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = params[key];
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
      }
    };

    handlePayment();
  }, [params]);

  return null;
};

export default ECPayForm;