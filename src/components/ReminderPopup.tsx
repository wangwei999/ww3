'use client';

import { useEffect, useState, useRef } from 'react';
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
  const [progress, setProgress] = useState(100);
  const [currentBg, setCurrentBg] = useState('');
  
  // 使用 ref 确保定时器被正确清理
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);

  // 初始化 - 只运行一次
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    // 随机选择背景
    const randomBg = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    setCurrentBg(randomBg);
    
    // 触发显示动画
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // 进度条倒计时
    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / (duration * 1000)) * 100);
      setProgress(remaining);
    }, 100);

    // 清理函数
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [duration]);

  const handleClose = () => {
    setIsVisible(false);
    // 清理进度定时器
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    // 延迟调用 onClose 以播放动画
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed bottom-8 left-8 z-50 transition-all duration-300 ease-out ${
        isVisible 
          ? 'translate-x-0 opacity-100 scale-100' 
          : '-translate-x-full opacity-0 scale-95'
      }`}
    >
      <div className="relative w-96 h-64 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/20">
        {/* 背景图片 */}
        {currentBg && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${currentBg})` }}
          />
        )}
        
        {/* 渐变遮罩层 */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/60 backdrop-blur-sm" />

        {/* 进度条 */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-800/50">
          <div
            className="h-full bg-gradient-to-r from-white/90 to-white/60 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 内容区域 */}
        <div className="relative h-full flex flex-col justify-between p-6">
          {/* 标题 */}
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold text-lg flex items-center gap-2 drop-shadow-lg">
              <span className="text-2xl animate-bounce">🔔</span>
              <span>提醒</span>
            </h3>
            <Button
              onClick={handleClose}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-8 w-8"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* 提醒内容 */}
          <div className="flex-1 flex items-center justify-center px-4">
            <p className="text-white text-xl font-medium text-center leading-relaxed drop-shadow-lg">
              {message}
            </p>
          </div>

          {/* 底部信息 */}
          <div className="flex items-center justify-between text-white/80 text-sm">
            <span className="flex items-center gap-1.5">
              <span>⏱️</span>
              <span>{duration}秒后自动关闭</span>
            </span>
            <span className="text-white/60 font-mono">
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
