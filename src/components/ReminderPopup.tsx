'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReminderPopupProps {
  message: string;
  duration: number;
  onClose: () => void;
}

// 背景图片列表
const backgrounds = [
  '/backgrounds/mountain-lake.jpeg',
  '/backgrounds/sunset-beach.jpeg',
  '/backgrounds/rainforest.jpeg',
  '/backgrounds/cherry-blossom.jpeg',
  '/backgrounds/autumn-forest.jpeg',
];

export default function ReminderPopup({ message, duration, onClose }: ReminderPopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentBg, setCurrentBg] = useState('');
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    // 随机选择背景
    const randomBg = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    setCurrentBg(randomBg);

    // 显示动画
    setTimeout(() => setIsVisible(true), 10);

    // 进度条倒计时
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / (duration * 1000)) * 100);
      setProgress(remaining);
      
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [duration]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed bottom-8 left-8 z-50 transition-all duration-300 ${
        isVisible ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
      }`}
    >
      <div className="relative w-96 h-64 rounded-2xl overflow-hidden shadow-2xl">
        {/* 背景图片 */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${currentBg})` }}
        />
        
        {/* 遮罩层 */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

        {/* 进度条 */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800/50">
          <div
            className="h-full bg-white/80 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 内容区域 */}
        <div className="relative h-full flex flex-col justify-between p-6">
          {/* 标题 */}
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <span className="text-2xl">🔔</span>
              提醒
            </h3>
            <Button
              onClick={handleClose}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* 提醒内容 */}
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white text-xl font-medium text-center leading-relaxed drop-shadow-lg">
              {message}
            </p>
          </div>

          {/* 底部信息 */}
          <div className="flex items-center justify-between text-white/80 text-sm">
            <span className="flex items-center gap-1">
              <span>⏱️</span>
              {duration}秒后自动关闭
            </span>
            <span className="text-white/60">
              {new Date().toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
