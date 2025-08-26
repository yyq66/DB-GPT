import { AudioOutlined, AudioMutedOutlined } from '@ant-design/icons';
import { Button, message } from 'antd';
import classNames from 'classnames';
import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Preset, Project, Global, Human, ASR } from "metamaker-human-card-kit";

interface VoiceInputProps {
  onResult?: (text: string) => void; // 语音识别结果回调
  onStatusChange?: (isListening: boolean) => void; // 状态变化回调
  disabled?: boolean; // 是否禁用
  className?: string; // 自定义样式
  size?: 'small' | 'middle' | 'large'; // 按钮大小
  type?: 'text' | 'primary' | 'default'; // 按钮类型
  showStatus?: boolean; // 是否显示状态文本
  autoStop?: number; // 自动停止时间（毫秒）
  token?: string; // ASR token
}

// ASR 结果类型定义
enum ASRType {
  mid = "mid",
  fin = "fin"
}

type ASRResult = {
  type: ASRType;
  current: string;
  transformText: string;
};

const TOKEN = "AW 3caa80d331ed4816b8aa002bde87ea55:MTc1NDYzMTc2NDrbpIX2Bw06etMX5+UEzzBxZJA0m1huZK9ruLbUChhqrA==";

const VoiceInput: React.FC<VoiceInputProps> = ({
  onResult,
  // onStatusChange,
  disabled = false,
  className = '',
  size = 'middle',
  type = 'text',
  // showStatus = false,
  autoStop = 30000, // 30秒自动停止
}) => {
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);


  // ASR 相关状态
  const asrContextRef = useRef<ASR | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [asrText, setAsrText] = useState("");

  // 初始化 ASR
  const initASR = () => {
    if (!TOKEN) return;

    try {
      asrContextRef.current = new ASR(TOKEN, { audio: true, video: false });
    } catch (error) {
      console.error('ASR 初始化失败:', error);
      message.error('语音识别初始化失败');
    }
  };

  // 处理 ASR 识别结果
  const handleASRResult = async (result: ASRResult) => {
    console.log(result)
    // console.log('ASR 识别结果:', result);
    setAsrText(result.transformText);
    onResult?.(result.transformText);

  };

  // 开始语音识别
  const startListening = async () => {
    if (!asrContextRef.current || isListening) return;

    try {
      // 设置自动停止定时器
      if (autoStop > 0) {
        autoStopTimerRef.current = setTimeout(() => {
          stopListening();
          message.warning('自动停止识别')
          // console.log("自动停止识别")
        }, autoStop);
      }
      setIsListening(true);
      setAsrText('');
      onResult?.(``);

      // 建立 websocket 连接
      await asrContextRef.current.openSocket();
      // 打开麦克风
      const result = await asrContextRef.current.openMicroPhone();

      if (result) {
        // 监听识别结果
        asrContextRef.current.addEventListener('transform', handleASRResult);
        message.success('开始语音识别，请说话...');
      } else {
        // 关闭连接
        asrContextRef.current.close();
        setIsListening(false);
        message.error('无法打开麦克风');
      }
    } catch (error) {
      console.error('开始语音识别失败:', error);
      setIsListening(false);
      message.error('语音识别启动失败');
    }
  };

  // 停止语音识别
  const stopListening = async () => {
    if (!asrContextRef.current || !isListening) return;

    try {
      // 等待完整的音频数据发送完毕
      const _finalResultText = await asrContextRef.current.transform();
      // onASRResult?.(_finalResultText);
      setAsrText(_finalResultText);
      console.log(_finalResultText)


      // 关闭连接
      asrContextRef.current.close();
      // 清空 ASR 上下文
      asrContextRef.current.clear();

      setIsListening(false);
      message.success('语音识别已停止');
    } catch (error) {
      console.error('停止语音识别失败:', error);
      setIsListening(false);
      message.error('停止语音识别失败');
    }
  };

  // 组件挂载时初始化ASR
  useEffect(() => {
    initASR();

    // 清理函数
    return () => {
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
      }
      if (isListening) {
        stopListening();
      }
    };
  }, [TOKEN]);

  return (
    <div className={`voice-input-container ${className}`}>
      <Button
        type={type}
        size={size}
        className={classNames(
          'voice-input-button',
          {
            'text-red-500': isListening,
            'text-blue-500': !isListening,
            'animate-pulse': isListening,
          },
        )}
        icon={isListening ? <AudioMutedOutlined /> : <AudioOutlined />}
        onClick={isListening ? stopListening : startListening}
        disabled={disabled}
        title={isListening ? '停止语音识别' : '开始语音识别'}
      />
    </div>
  );
};

export default VoiceInput;
