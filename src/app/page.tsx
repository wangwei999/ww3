'use client';

// 定时提醒应用主页面
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Play, Square, FileText, Clock, Eye, Bell, BellOff } from 'lucide-react';
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
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const popupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  
  // 使用 ref 存储最新值
  const remindersRef = useRef<string[]>([]);
  const displayDurationRef = useRef<number>(20);
  const intervalMinutesRef = useRef<number>(5);

  // 同步 ref 值
  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

  useEffect(() => {
    displayDurationRef.current = displayDuration;
  }, [displayDuration]);

  useEffect(() => {
    intervalMinutesRef.current = intervalMinutes;
  }, [intervalMinutes]);

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
  const sendSystemNotification = useCallback((message: string) => {
    if (notificationPermission !== 'granted') {
      console.log('⚠️ 通知权限未授权，跳过系统通知');
      return;
    }

    // 随机选择背景
    const randomFile = backgroundFiles[Math.floor(Math.random() * backgroundFiles.length)];
    const imageUrl = getBackgroundUrl(randomFile);
    
    try {
      // 创建通知选项
      const options: NotificationOptions & { image?: string } = {
        body: message,
        icon: imageUrl,        // 小图标
        image: imageUrl,       // 大图（部分浏览器支持）
        tag: 'reminder-notification',
        requireInteraction: true,
        silent: false,
      };

      const notification = new Notification('🔔 定时提醒', options);

      // 点击通知时聚焦窗口
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // 自动关闭通知
      setTimeout(() => {
        notification.close();
      }, displayDurationRef.current * 1000);

      console.log('🔔 系统通知已发送，图片:', imageUrl);
    } catch (error) {
      console.error('发送通知失败:', error);
    }
  }, [notificationPermission]);

  // 处理文件上传
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  // 显示随机提醒
  const showRandomReminder = useCallback(() => {
    const currentReminders = remindersRef.current;
    const currentDuration = displayDurationRef.current;
    
    console.log('🔔 showRandomReminder called, reminders:', currentReminders.length);
    
    if (currentReminders.length === 0) {
      console.log('❌ No reminders, skipping');
      return;
    }
    
    // 先关闭当前弹窗
    setShowPopup(false);
    
    // 清除之前的弹窗定时器
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }
    
    // 短暂延迟后显示新弹窗，确保动画重置
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * currentReminders.length);
      const selectedReminder = currentReminders[randomIndex];
      console.log('📝 Selected reminder:', selectedReminder);
      
      setCurrentReminder(selectedReminder);
      setPopupKey(prev => prev + 1);
      setShowPopup(true);

      // 发送系统通知
      sendSystemNotification(selectedReminder);

      // 设置自动关闭
      popupTimerRef.current = setTimeout(() => {
        console.log('⏰ Auto closing popup');
        setShowPopup(false);
      }, currentDuration * 1000);
    }, 50);
  }, [sendSystemNotification]);

  // 开始定时器
  const startTimer = useCallback(() => {
    const currentReminders = remindersRef.current;
    
    console.log('▶️ startTimer called, reminders:', currentReminders.length);
    
    if (currentReminders.length === 0) {
      alert('请先上传提醒内容文件');
      return;
    }

    // 检查通知权限
    if (notificationPermission !== 'granted') {
      const shouldRequest = confirm('建议开启系统通知权限，这样即使浏览器最小化也能收到提醒。\n\n是否现在开启？');
      if (shouldRequest) {
        requestNotificationPermission();
      }
    }

    // 清除所有现有定时器
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

    // 立即显示第一次
    console.log('🚀 Showing first reminder');
    showRandomReminder();

    // 设置主定时器
    const intervalMs = interval * 60 * 1000;
    console.log(`⏱️ Setting interval: ${interval} minutes (${intervalMs}ms)`);
    
    timerRef.current = setInterval(() => {
      console.log('🔄 Interval triggered at:', new Date().toLocaleTimeString());
      showRandomReminder();
      setCountdown(intervalMinutesRef.current * 60);
    }, intervalMs);

    // 倒计时定时器
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
            <CardContent className="pt-4 flex items-center justify-between">
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
                <FileText className="w-5 h-5" />
                内容文件
              </CardTitle>
              <CardDescription>上传 TXT 或 XLSX 文件，每行作为一个提醒内容</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".txt,.xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={isRunning}
                  className="hidden"
                  id="file-upload"
                />
                <Button
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={isRunning}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  选择文件
                </Button>
              </div>

              {fileName && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{fileName}</span>
                </div>
              )}

              {reminders.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  已加载 <span className="font-bold text-primary">{reminders.length}</span> 条提醒内容
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
                    disabled={reminders.length === 0}
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

        {/* 提示信息 */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            使用说明
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>1. 点击"开启通知"按钮，授权系统通知权限</li>
            <li>2. 上传 TXT 或 XLSX 文件，每行内容将作为一条提醒</li>
            <li>3. 设置提醒间隔（1-60分钟）和显示时长（20-60秒）</li>
            <li>4. 点击"开始提醒"，系统将按时弹出提醒窗口</li>
            <li>5. 即使浏览器最小化，也会收到系统通知提醒</li>
          </ul>
        </div>
      </div>

      {/* 提醒弹窗 - 使用 key 强制重新渲染 */}
      {showPopup && currentReminder && (
        <ReminderPopup
          key={popupKey}
          message={currentReminder}
          duration={displayDuration}
          onClose={handleClosePopup}
        />
      )}
    </div>
  );
}
