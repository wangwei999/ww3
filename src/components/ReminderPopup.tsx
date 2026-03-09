'use client';

import { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReminderPopupProps {
  message: string;
  duration: number;
  onClose: () => void;
}

// 背景图片列表 - 高清4K自然景观
const backgrounds = [
  '/backgrounds/mountain-lake-hd.jpeg',      // 日出山湖
  '/backgrounds/tropical-beach-hd.jpeg',     // 热带海滩
  '/backgrounds/forest-sunlight-hd.jpeg',    // 阳光森林
  '/backgrounds/lavender-fields-hd.jpeg',    // 薰衣草田
  '/backgrounds/aurora-borealis-hd.jpeg',    // 北极光
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
      {/* 进度条 - 放在最外层顶部 */}
      <div className="absolute -top-1 left-0 right-0 h-1.5 bg-gray-300/50 rounded-full overflow-hidden z-10">
        <div
          className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex flex-col w-[420px] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-gray-200/50 bg-white">
        {/* 上方：图片区域 */}
        <div className="relative h-[240px] w-full overflow-hidden">
          {currentBg && (
            <img
              src={currentBg}
              alt="自然景观"
              className="w-full h-full object-cover"
            />
          )}
          {/* 图片上的标题 */}
          <div className="absolute top-3 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
            <span className="text-xl animate-bounce">🔔</span>
            <span className="text-white font-semibold text-sm">提醒</span>
          </div>
          {/* 关闭按钮 */}
          <Button
            onClick={handleClose}
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 text-white hover:bg-black/30 h-8 w-8 rounded-full bg-black/20 backdrop-blur-sm"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* 下方：文字内容区域 */}
        <div className="flex flex-col bg-white">
          {/* 提醒内容 */}
          <div className="p-4 max-h-[120px] overflow-y-auto
            [&::-webkit-scrollbar]:w-1.5
            [&::-webkit-scrollbar-track]:bg-gray-100
            [&::-webkit-scrollbar-track]:rounded-full
            [&::-webkit-scrollbar-thumb]:bg-gray-300
            [&::-webkit-scrollbar-thumb]:rounded-full
            [&::-webkit-scrollbar-thumb]:hover:bg-gray-400"
          >
            <p className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap">
              {message}
            </p>
          </div>

          {/* 底部信息 */}
          <div className="flex items-center justify-between text-gray-500 text-xs px-4 py-2 border-t border-gray-100 bg-gray-50/50">
            <span className="flex items-center gap-1">
              <span>⏱️</span>
              <span>{duration}秒后自动关闭</span>
            </span>
            <span className="font-mono text-gray-400">
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
