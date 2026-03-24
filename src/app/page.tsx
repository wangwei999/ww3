'use client';

// 定时提醒应用主页面
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Play, Square, FileText, Clock, Eye, Bell, BellOff, Trash2, BookOpen, Loader2, Download, Heart, Activity } from 'lucide-react';
import ReminderPopup from '@/components/ReminderPopup';
import * as XLSX from 'xlsx';

// 背景图片列表 - 用于通知图标（使用完整URL）
const getBackgroundUrl = (filename: string) => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/backgrounds/${filename}`;
  }
  return `/backgrounds/${filename}`;
};

const backgroundFiles = [
  'mountain-lake-hd.jpeg',
  'tropical-beach-hd.jpeg',
  'forest-sunlight-hd.jpeg',
  'lavender-fields-hd.jpeg',
  'aurora-borealis-hd.jpeg',
];

// 支持的电子书格式
const bookFormats = ['pdf', 'epub', 'docx', 'doc'];
const reminderFormats = ['txt', 'xlsx', 'xls'];

// Fisher-Yates 洗牌算法
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// 久坐提醒内容列表
const healthReminders = [
  '🧘 该休息一下了！站起来活动活动，伸个懒腰吧~',
  '👀 眼睛需要休息啦！看看远处的绿色植物，让眼睛放松一下~',
  '🚶 久坐提醒：站起来走几步，活动一下筋骨！',
  '💧 记得喝口水，保持身体水分充足哦~',
  '🌿 深呼吸一下，让大脑和身体都放松放松~',
  '🏃 该动一动了！做几个简单的拉伸动作吧~',
  '👁️ 20-20-20法则：每20分钟看20英尺外的东西20秒~',
  '☕ 休息时间到！站起来接杯水或者上个厕所吧~',
];

export default function Home() {
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [displayDuration, setDisplayDuration] = useState(20);
  const [reminders, setReminders] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentReminder, setCurrentReminder] = useState<string>('');
  const [showPopup, setShowPopup] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);
  const [popupKey, setPopupKey] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  
  // 拆书功能相关状态
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState('');
  const [fileMode, setFileMode] = useState<'reminder' | 'book'>('reminder');
  const [extractedKeyPoints, setExtractedKeyPoints] = useState<string[]>([]);
  
  // 久坐提醒相关状态
  const [healthIntervalMinutes, setHealthIntervalMinutes] = useState(20);
  const [healthDisplayDuration, setHealthDisplayDuration] = useState(20);
  const [healthReminderEnabled, setHealthReminderEnabled] = useState(false);
  const [showHealthPopup, setShowHealthPopup] = useState(false);
  const [healthPopupKey, setHealthPopupKey] = useState(0);
  const [healthCountdown, setHealthCountdown] = useState<number>(0);
  const [healthReminder, setHealthReminder] = useState<string>('');
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const popupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const healthTimerRef = useRef<NodeJS.Timeout | null>(null);
  const healthPopupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const healthCountdownRef = useRef<NodeJS.Timeout | null>(null);
  
  // 使用 ref 存储最新值
  const remindersRef = useRef<string[]>([]);
  const displayDurationRef = useRef<number>(20);
  const intervalMinutesRef = useRef<number>(5);
  const healthIntervalMinutesRef = useRef<number>(20);
  const healthDisplayDurationRef = useRef<number>(20);
  const showHealthPopupRef = useRef<boolean>(false);
  const sendSystemNotificationRef = useRef<(message: string, title?: string) => void>(() => {});
  
  // 随机选择相关 ref - 确保每个内容都能被显示
  const availableIndicesRef = useRef<number[]>([]);
  const healthAvailableIndicesRef = useRef<number[]>([]);

  // 同步 ref 值
  useEffect(() => {
    remindersRef.current = reminders;
    // 当提醒内容改变时，重置可用索引列表
    if (reminders.length > 0) {
      availableIndicesRef.current = Array.from({ length: reminders.length }, (_, i) => i);
      shuffleArray(availableIndicesRef.current);
      console.log('🔄 已重置提醒索引列表，总数:', reminders.length);
    }
  }, [reminders]);

  useEffect(() => {
    displayDurationRef.current = displayDuration;
  }, [displayDuration]);

  useEffect(() => {
    intervalMinutesRef.current = intervalMinutes;
  }, [intervalMinutes]);

  useEffect(() => {
    healthIntervalMinutesRef.current = healthIntervalMinutes;
  }, [healthIntervalMinutes]);

  useEffect(() => {
    healthDisplayDurationRef.current = healthDisplayDuration;
  }, [healthDisplayDuration]);

  useEffect(() => {
    showHealthPopupRef.current = showHealthPopup;
  }, [showHealthPopup]);

  // 检查通知权限
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // 请求通知权限
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('您的浏览器不支持系统通知');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    
    if (permission === 'granted') {
      console.log('✅ 通知权限已授权');
    } else if (permission === 'denied') {
      alert('通知权限被拒绝，您将无法在浏览器最小化时收到提醒。\n请在浏览器设置中允许通知。');
    }
  }, []);

  // 发送系统通知
  const sendSystemNotification = useCallback((message: string, title: string = '🔔 定时提醒') => {
    if (notificationPermission !== 'granted') {
      console.log('⚠️ 通知权限未授权，跳过系统通知');
      return;
    }

    const randomFile = backgroundFiles[Math.floor(Math.random() * backgroundFiles.length)];
    const imageUrl = getBackgroundUrl(randomFile);
    
    try {
      const options: NotificationOptions & { image?: string } = {
        body: message,
        icon: imageUrl,
        image: imageUrl,
        tag: title === '💚 久坐提醒' ? 'health-reminder' : 'reminder-notification',
        requireInteraction: true,
        silent: false,
      };

      const notification = new Notification(title, options);

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setTimeout(() => {
        notification.close();
      }, displayDurationRef.current * 1000);

      console.log('🔔 系统通知已发送:', title);
    } catch (error) {
      console.error('发送通知失败:', error);
    }
  }, [notificationPermission]);

  // 保持 ref 最新
  sendSystemNotificationRef.current = sendSystemNotification;

  // 下载TXT文件
  const downloadTxtFile = useCallback((content: string[], originalFileName: string) => {
    const text = content.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const baseName = originalFileName.replace(/\.[^/.]+$/, '');
    link.href = url;
    link.download = `${baseName}_要点金句.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // 处理电子书文件（拆书功能）
  const handleBookFile = useCallback(async (file: File) => {
    // 检查文件大小（限制 50MB）
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      alert(`文件过大，请上传小于 50MB 的文件。\n当前文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }
    
    setIsExtracting(true);
    setExtractProgress('正在读取文件...');
    setFileMode('book');
    
    try {
      const fileType = file.name.split('.').pop()?.toLowerCase() || '';
      
      // 大文件（>5MB）使用分块上传
      const useChunkedUpload = file.size > 5 * 1024 * 1024;
      
      let storageKey: string | null = null;
      
      if (useChunkedUpload) {
        // 分块上传
        setExtractProgress('正在上传文件（分块上传）...');
        
        const chunkSize = 2 * 1024 * 1024; // 2MB 每块
        const totalChunks = Math.ceil(file.size / chunkSize);
        
        // 步骤1：初始化上传
        const initResponse = await fetch('/api/upload-file/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            totalChunks,
          }),
        });
        
        if (!initResponse.ok) {
          throw new Error('初始化上传失败');
        }
        
        const { uploadId, key } = await initResponse.json();
        storageKey = key;
        
        // 步骤2：上传每个分块
        for (let i = 0; i < totalChunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, file.size);
          const chunk = file.slice(start, end);
          
          setExtractProgress(`正在上传: ${Math.round((i + 1) / totalChunks * 100)}%`);
          
          const chunkFormData = new FormData();
          chunkFormData.append('chunk', chunk);
          chunkFormData.append('uploadId', uploadId);
          chunkFormData.append('chunkIndex', String(i));
          chunkFormData.append('totalChunks', String(totalChunks));
          
          const chunkResponse = await fetch('/api/upload-file/chunk', {
            method: 'POST',
            body: chunkFormData,
          });
          
          if (!chunkResponse.ok) {
            throw new Error(`上传分块 ${i + 1} 失败`);
          }
        }
        
        // 步骤3：完成上传
        const completeResponse = await fetch('/api/upload-file/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId, key }),
        });
        
        if (!completeResponse.ok) {
          throw new Error('完成上传失败');
        }
        
        const completeResult = await completeResponse.json();
        // 使用实际返回的 key（SDK 会添加 UUID 前缀）
        storageKey = completeResult.key;
        
        console.log(`分块上传完成，实际 key: ${storageKey}`);
      }
      
      // 步骤4：调用处理 API
      setExtractProgress('正在解析内容...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);
      
      let response: Response;
      
      if (storageKey) {
        // 通过对象存储 key 处理
        response = await fetch('/api/extract-book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storageKey,
            fileType,
          }),
          signal: controller.signal,
        });
      } else {
        // 小文件直接上传处理
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileType', fileType);
        
        response = await fetch('/api/extract-book', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
      }
      
      clearTimeout(timeoutId);
      
      // 检查是否是代理错误（502/504）
      if (response.status === 502 || response.status === 504) {
        throw new Error('服务器繁忙，请稍后重试。如果文件较大，可能需要等待更长时间。');
      }
      
      // 先检查响应状态，再解析 JSON
      if (!response.ok) {
        const text = await response.text();
        // 检查是否是 HTML 错误页面（代理返回）
        if (text.includes('<html>') || text.includes('<!DOCTYPE')) {
          throw new Error('网络错误，请检查网络连接后重试');
        }
        let errorMsg = '处理失败';
        try {
          const errorData = JSON.parse(text);
          errorMsg = errorData.error || errorMsg;
        } catch {
          errorMsg = text.slice(0, 100) || errorMsg;
        }
        throw new Error(errorMsg);
      }
      
      const result = await response.json();
      
      setExtractProgress('提取完成！');
      setExtractedKeyPoints(result.keyPoints);
      
      // 自动下载TXT文件
      downloadTxtFile(result.keyPoints, file.name);
      
      // 自动加载到提醒功能
      setReminders(result.keyPoints);
      setFileName(file.name);
      
      console.log(`📚 拆书完成，提取了 ${result.keyPoints.length} 条要点`);
      
    } catch (error) {
      console.error('拆书失败:', error);
      // 处理不同类型的错误
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          alert('请求超时，文件可能过大。建议上传小于 20MB 的文件。');
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          alert('网络连接失败，请检查网络后重试');
        } else {
          alert(`拆书失败: ${error.message}`);
        }
      } else {
        alert('拆书失败: 未知错误');
      }
      setFileMode('reminder');
    } finally {
      setIsExtracting(false);
      setExtractProgress('');
    }
  }, [downloadTxtFile]);

  // 处理提醒内容文件
  const handleReminderFile = useCallback(async (file: File) => {
    setFileMode('reminder');
    setFileName(file.name);
    const extension = file.name.split('.').pop()?.toLowerCase();

    try {
      if (extension === 'txt') {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');
        setReminders(lines);
      } else if (extension === 'xlsx' || extension === 'xls') {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];
        
        const allTexts: string[] = [];
        jsonData.forEach(row => {
          row.forEach(cell => {
            if (cell && typeof cell === 'string' && cell.trim() !== '') {
              allTexts.push(cell.trim());
            }
          });
        });
        setReminders(allTexts);
      }
    } catch (error) {
      console.error('文件解析错误:', error);
      alert('文件解析失败，请检查文件格式');
    }
  }, []);

  // 统一的文件上传处理
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    
    // 判断文件类型
    if (bookFormats.includes(extension || '')) {
      // 电子书文件 -> 拆书模式
      await handleBookFile(file);
    } else if (reminderFormats.includes(extension || '')) {
      // 提醒内容文件
      await handleReminderFile(file);
    } else {
      alert(`不支持的文件格式: ${extension}\n支持的格式: PDF, EPUB, DOCX, TXT, XLSX`);
    }
    
    // 重置input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleBookFile, handleReminderFile]);

  // 清除已上传的文件
  const handleClearFile = useCallback(() => {
    setFileName('');
    setReminders([]);
    setExtractedKeyPoints([]);
    setFileMode('reminder');
    console.log('🗑️ 文件已清除');
  }, []);

  // 显示随机提醒
  // 获取下一个公平随机的提醒索引
  const getNextReminderIndex = useCallback((totalCount: number): number => {
    // 如果可用索引列表为空或数量不匹配，重新初始化
    if (availableIndicesRef.current.length === 0 || availableIndicesRef.current.length !== totalCount) {
      availableIndicesRef.current = Array.from({ length: totalCount }, (_, i) => i);
      shuffleArray(availableIndicesRef.current);
      console.log('🔄 重新初始化提醒索引列表，总数:', totalCount);
    }
    
    // 从列表末尾取出一个索引（已洗牌，所以是随机的）
    const index = availableIndicesRef.current.pop()!;
    const remaining = availableIndicesRef.current.length;
    console.log(`📊 选择索引 ${index}，剩余 ${remaining} 个未显示`);
    
    return index;
  }, []);

  // 获取下一个公平随机的久坐提醒索引
  const getNextHealthReminderIndex = useCallback((): number => {
    const totalCount = healthReminders.length;
    
    // 如果可用索引列表为空，重新初始化
    if (healthAvailableIndicesRef.current.length === 0) {
      healthAvailableIndicesRef.current = Array.from({ length: totalCount }, (_, i) => i);
      shuffleArray(healthAvailableIndicesRef.current);
      console.log('🔄 重新初始化久坐提醒索引列表，总数:', totalCount);
    }
    
    // 从列表末尾取出一个索引
    const index = healthAvailableIndicesRef.current.pop()!;
    const remaining = healthAvailableIndicesRef.current.length;
    console.log(`📊 久坐提醒选择索引 ${index}，剩余 ${remaining} 个未显示`);
    
    return index;
  }, []);

  const showRandomReminder = useCallback(() => {
    const currentReminders = remindersRef.current;
    const currentDuration = displayDurationRef.current;
    
    console.log('🔔 showRandomReminder called, reminders:', currentReminders.length);
    
    if (currentReminders.length === 0) {
      console.log('❌ No reminders, skipping');
      return;
    }
    
    // 如果久坐提醒正在显示，跳过文件上传模式的提醒（久坐优先）
    if (showHealthPopupRef.current) {
      console.log('💚 久坐提醒正在显示，跳过文件上传提醒');
      return;
    }
    
    setShowPopup(false);
    
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }
    
    setTimeout(() => {
      // 再次检查久坐提醒是否正在显示（使用 ref 获取最新值）
      if (showHealthPopupRef.current) {
        console.log('💚 久坐提醒正在显示，跳过文件上传提醒');
        return;
      }
      
      // 使用公平随机选择
      const randomIndex = getNextReminderIndex(currentReminders.length);
      const selectedReminder = currentReminders[randomIndex];
      console.log('📝 Selected reminder (index:', randomIndex, '):', selectedReminder);
      
      setCurrentReminder(selectedReminder);
      setPopupKey(prev => prev + 1);
      setShowPopup(true);
      sendSystemNotification(selectedReminder);

      popupTimerRef.current = setTimeout(() => {
        console.log('⏰ Auto closing popup');
        setShowPopup(false);
      }, currentDuration * 1000);
    }, 50);
  }, [sendSystemNotification, getNextReminderIndex]);

  // 开始定时器
  const startTimer = useCallback(() => {
    const currentReminders = remindersRef.current;
    
    console.log('▶️ startTimer called, reminders:', currentReminders.length);
    
    if (currentReminders.length === 0) {
      alert('请先上传内容文件');
      return;
    }

    if (notificationPermission !== 'granted') {
      const shouldRequest = confirm('建议开启系统通知权限，这样即使浏览器最小化也能收到提醒。\n\n是否现在开启？');
      if (shouldRequest) {
        requestNotificationPermission();
      }
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }

    setIsRunning(true);
    const interval = intervalMinutesRef.current;
    setCountdown(interval * 60);

    console.log('🚀 Showing first reminder');
    showRandomReminder();

    const intervalMs = interval * 60 * 1000;
    console.log(`⏱️ Setting interval: ${interval} minutes (${intervalMs}ms)`);
    
    timerRef.current = setInterval(() => {
      console.log('🔄 Interval triggered at:', new Date().toLocaleTimeString());
      showRandomReminder();
      setCountdown(intervalMinutesRef.current * 60);
    }, intervalMs);

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          return intervalMinutesRef.current * 60;
        }
        return prev - 1;
      });
    }, 1000);
  }, [showRandomReminder, notificationPermission, requestNotificationPermission]);

  // 停止定时器
  const stopTimer = useCallback(() => {
    console.log('⏹️ Stopping timer');
    setIsRunning(false);
    setShowPopup(false);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    
    setCountdown(0);
  }, []);

  // 显示久坐提醒
  const showHealthReminder = useCallback(() => {
    console.log('🚀 showHealthReminder 被调用');
    const randomIndex = getNextHealthReminderIndex();
    const reminder = healthReminders[randomIndex];
    console.log('📝 提醒内容 (index:', randomIndex, '):', reminder);
    
    setHealthReminder(reminder);
    setHealthPopupKey(prev => prev + 1);
    setShowHealthPopup(true);
    console.log('✅ setShowHealthPopup(true) 已调用');
    
    // 发送系统通知
    if (notificationPermission === 'granted') {
      const randomFile = backgroundFiles[Math.floor(Math.random() * backgroundFiles.length)];
      const imageUrl = getBackgroundUrl(randomFile);
      
      try {
        new Notification('💚 久坐提醒', {
          body: reminder,
          icon: imageUrl,
          tag: 'health-reminder',
          requireInteraction: true,
        });
      } catch (error) {
        console.error('系统通知失败:', error);
      }
    }
    
    // 使用配置的显示时长
    const duration = healthDisplayDurationRef.current;
    healthPopupTimerRef.current = setTimeout(() => {
      setShowHealthPopup(false);
    }, duration * 1000);
  }, [notificationPermission, getNextHealthReminderIndex]);

  // 开启/关闭久坐提醒
  const toggleHealthReminder = useCallback(() => {
    if (!healthReminderEnabled) {
      // 开启
      setHealthReminderEnabled(true);
      
      // 检查通知权限
      if (notificationPermission !== 'granted') {
        const shouldRequest = confirm('建议开启系统通知权限，这样右下角也能收到提醒通知。\n\n是否现在开启？');
        if (shouldRequest) {
          requestNotificationPermission();
        }
      }
      
      // 使用配置的间隔
      const intervalMinutes = healthIntervalMinutesRef.current;
      const intervalMs = intervalMinutes * 60 * 1000;
      
      console.log(`💚 久坐提醒已开启，间隔 ${intervalMinutes} 分钟`);
      
      // 设置倒计时
      setHealthCountdown(intervalMinutes * 60);
      
      // 定义显示提醒的函数（直接在这里定义，避免闭包问题）
      const displayReminder = () => {
        console.log('🚀 displayReminder 被调用');
        
        // 使用公平随机选择
        if (healthAvailableIndicesRef.current.length === 0) {
          healthAvailableIndicesRef.current = Array.from({ length: healthReminders.length }, (_, i) => i);
          shuffleArray(healthAvailableIndicesRef.current);
          console.log('🔄 重新初始化久坐提醒索引列表');
        }
        const randomIndex = healthAvailableIndicesRef.current.pop()!;
        const reminder = healthReminders[randomIndex];
        console.log('📝 提醒内容 (index:', randomIndex, '):', reminder);
        
        // 久坐提醒优先：关闭文件上传模式的弹窗
        setShowPopup(false);
        if (popupTimerRef.current) {
          clearTimeout(popupTimerRef.current);
          popupTimerRef.current = null;
        }
        
        setHealthReminder(reminder);
        setHealthPopupKey(prev => prev + 1);
        setShowHealthPopup(true);
        console.log('✅ setShowHealthPopup(true) 已调用，已关闭文件上传模式弹窗');
        
        // 发送系统通知（和文件上传模式一样调用 sendSystemNotification）
        sendSystemNotificationRef.current(reminder, '💚 久坐提醒');
        
        // 自动关闭
        const duration = healthDisplayDurationRef.current;
        if (healthPopupTimerRef.current) {
          clearTimeout(healthPopupTimerRef.current);
        }
        healthPopupTimerRef.current = setTimeout(() => {
          setShowHealthPopup(false);
        }, duration * 1000);
      };
      
      // 立即显示一次
      setTimeout(displayReminder, 1000);
      
      // 定时提醒
      healthTimerRef.current = setInterval(() => {
        displayReminder();
        setHealthCountdown(intervalMinutes * 60);
      }, intervalMs);
      
      // 倒计时每秒更新
      healthCountdownRef.current = setInterval(() => {
        setHealthCountdown(prev => {
          if (prev <= 1) {
            return intervalMinutes * 60;
          }
          return prev - 1;
        });
      }, 1000);
      
    } else {
      // 关闭
      setHealthReminderEnabled(false);
      setShowHealthPopup(false);
      setHealthCountdown(0);
      
      if (healthTimerRef.current) {
        clearInterval(healthTimerRef.current);
        healthTimerRef.current = null;
      }
      if (healthPopupTimerRef.current) {
        clearTimeout(healthPopupTimerRef.current);
        healthPopupTimerRef.current = null;
      }
      if (healthCountdownRef.current) {
        clearInterval(healthCountdownRef.current);
        healthCountdownRef.current = null;
      }
      
      console.log('💔 久坐提醒已关闭');
    }
  }, [healthReminderEnabled, notificationPermission, requestNotificationPermission]);

  // 关闭弹窗
  const handleClosePopup = useCallback(() => {
    console.log('✖️ Popup closed by user');
    setShowPopup(false);
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (healthTimerRef.current) clearInterval(healthTimerRef.current);
      if (healthPopupTimerRef.current) clearTimeout(healthPopupTimerRef.current);
      if (healthCountdownRef.current) clearInterval(healthCountdownRef.current);
    };
  }, []);

  // 格式化倒计时
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            定时提醒助手
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            上传内容文件，设置提醒间隔，让提醒按时送达
          </p>
        </div>

        {/* 通知权限状态 */}
        {notificationPermission !== 'granted' && (
          <Card className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
            <CardContent className="pt-4 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <BellOff className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    系统通知未开启
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    开启后即使浏览器最小化也能收到提醒
                  </p>
                </div>
              </div>
              <Button 
                onClick={requestNotificationPermission}
                variant="outline"
                className="gap-2 border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900"
              >
                <Bell className="w-4 h-4" />
                开启通知
              </Button>
            </CardContent>
          </Card>
        )}

        {notificationPermission === 'granted' && (
          <Card className="mb-6 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
            <CardContent className="pt-4 flex items-center gap-3">
              <Bell className="w-5 h-5 text-green-600 dark:text-green-400" />
              <p className="text-green-800 dark:text-green-200">
                ✅ 系统通知已开启，浏览器最小化时也能收到提醒
              </p>
            </CardContent>
          </Card>
        )}

        {/* 主要内容 */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* 配置卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                提醒配置
              </CardTitle>
              <CardDescription>设置提醒的时间间隔和显示时长</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 弹出间隔 */}
              <div className="space-y-2">
                <Label htmlFor="interval">弹出间隔（分钟）</Label>
                <Select
                  value={intervalMinutes.toString()}
                  onValueChange={(value) => setIntervalMinutes(parseInt(value))}
                  disabled={isRunning}
                >
                  <SelectTrigger id="interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 3, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(min => (
                      <SelectItem key={min} value={min.toString()}>
                        {min} 分钟
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 显示时长 */}
              <div className="space-y-2">
                <Label htmlFor="duration">显示时长（秒）</Label>
                <Select
                  value={displayDuration.toString()}
                  onValueChange={(value) => setDisplayDuration(parseInt(value))}
                  disabled={isRunning}
                >
                  <SelectTrigger id="duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[20, 30, 40, 50, 60].map(sec => (
                      <SelectItem key={sec} value={sec.toString()}>
                        {sec} 秒
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* 文件上传卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {fileMode === 'book' ? (
                  <>
                    <BookOpen className="w-5 h-5" />
                    拆书模式
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    内容文件
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {fileMode === 'book' 
                  ? 'AI自动提取书籍要点和金句' 
                  : '上传 TXT/XLSX 文件，每行作为一个提醒内容'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".txt,.xlsx,.xls,.pdf,.epub,.docx,.doc"
                  onChange={handleFileUpload}
                  disabled={isRunning || isExtracting}
                  className="hidden"
                  id="file-upload"
                  ref={fileInputRef}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRunning || isExtracting}
                  className="flex-1"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {extractProgress}
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      选择文件
                    </>
                  )}
                </Button>
                {fileName && !isExtracting && (
                  <Button
                    onClick={handleClearFile}
                    disabled={isRunning}
                    variant="outline"
                    size="icon"
                    className="shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    title="删除文件"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {fileName && !isExtracting && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    {fileMode === 'book' ? (
                      <BookOpen className="w-4 h-4 text-purple-500 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">{fileName}</span>
                  </div>
                </div>
              )}

              {isExtracting && extractProgress && (
                <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">{extractProgress}</span>
                  </div>
                </div>
              )}

              {reminders.length > 0 && !isExtracting && (
                <div className="text-sm text-muted-foreground">
                  {fileMode === 'book' ? (
                    <span className="flex items-center gap-1">
                      <Download className="w-4 h-4" />
                      已提取 <span className="font-bold text-primary">{reminders.length}</span> 条要点/金句并自动下载
                    </span>
                  ) : (
                    <span>已加载 <span className="font-bold text-primary">{reminders.length}</span> 条提醒内容</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 控制区域 */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                {!isRunning ? (
                  <Button
                    onClick={startTimer}
                    disabled={reminders.length === 0 || isExtracting}
                    size="lg"
                    className="gap-2"
                  >
                    <Play className="w-5 h-5" />
                    开始提醒
                  </Button>
                ) : (
                  <Button
                    onClick={stopTimer}
                    variant="destructive"
                    size="lg"
                    className="gap-2"
                  >
                    <Square className="w-5 h-5" />
                    停止提醒
                  </Button>
                )}

                {isRunning && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">
                      运行中
                    </span>
                  </div>
                )}
              </div>

              {isRunning && (
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                  <span className="text-lg font-mono font-bold text-blue-700 dark:text-blue-300">
                    {formatCountdown(countdown)}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 久坐提醒卡片 */}
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Heart className="w-5 h-5 text-pink-500" />
              久坐/望远提醒
            </CardTitle>
            <CardDescription>定时提醒您休息，保护眼睛和身体健康</CardDescription>
          </CardHeader>
          <CardContent>
            {/* 配置选项 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">弹出间隔（分钟）</label>
                <Select 
                  value={healthIntervalMinutes.toString()} 
                  onValueChange={(value) => setHealthIntervalMinutes(parseInt(value))}
                  disabled={healthReminderEnabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 5, 10, 15, 20, 25, 30, 45, 60].map(min => (
                      <SelectItem key={min} value={min.toString()}>
                        {min} 分钟
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">显示时长（秒）</label>
                <Select 
                  value={healthDisplayDuration.toString()} 
                  onValueChange={(value) => setHealthDisplayDuration(parseInt(value))}
                  disabled={healthReminderEnabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 15, 20, 25, 30, 45, 60].map(sec => (
                      <SelectItem key={sec} value={sec.toString()}>
                        {sec} 秒
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className={`w-8 h-8 ${healthReminderEnabled ? 'text-green-500 animate-pulse' : 'text-gray-400'}`} />
                <div>
                  <p className="font-medium">
                    {healthReminderEnabled ? '久坐提醒已开启' : '久坐提醒已关闭'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    每{healthIntervalMinutes}分钟弹窗提醒，显示{healthDisplayDuration}秒
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* 显示倒计时 */}
                {healthReminderEnabled && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-pink-100 dark:bg-pink-900 rounded-lg">
                    <Clock className="w-4 h-4 text-pink-600 dark:text-pink-300" />
                    <span className="text-lg font-mono font-bold text-pink-700 dark:text-pink-300">
                      {formatCountdown(healthCountdown)}
                    </span>
                  </div>
                )}
                
                <Button
                  onClick={toggleHealthReminder}
                  variant={healthReminderEnabled ? 'destructive' : 'default'}
                  className="gap-2"
                >
                  {healthReminderEnabled ? (
                    <>
                      <Square className="w-4 h-4" />
                      关闭
                    </>
                  ) : (
                    <>
                      <Heart className="w-4 h-4" />
                      开启
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 提示信息 */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            使用说明
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>📌 <strong>提醒模式</strong>：上传 TXT/XLSX 文件，每行作为一条提醒</li>
            <li>📚 <strong>拆书模式</strong>：上传 PDF/EPUB/DOCX 电子书，AI自动提取要点金句</li>
            <li>⏰ 设置提醒间隔（1-60分钟）和显示时长（20-60秒）</li>
            <li>🔔 开启系统通知，浏览器最小化时也能收到提醒</li>
          </ul>
        </div>
      </div>

      {/* 提醒弹窗 */}
      {showPopup && currentReminder && (
        <ReminderPopup
          key={popupKey}
          message={currentReminder}
          duration={displayDuration}
          onClose={handleClosePopup}
        />
      )}

      {/* 久坐提醒弹窗 */}
      {(() => {
        // 调试日志
        if (showHealthPopup) {
          console.log('🟢 渲染久坐提醒弹窗:', { showHealthPopup, healthReminder, healthPopupKey });
        }
        return showHealthPopup && healthReminder && (
          <ReminderPopup
            key={`health-${healthPopupKey}`}
            message={healthReminder}
            duration={healthDisplayDuration}
            onClose={() => setShowHealthPopup(false)}
            isHealthReminder={true}
          />
        );
      })()}
    </div>
  );
}
