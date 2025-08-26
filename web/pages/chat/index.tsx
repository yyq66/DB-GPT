import { ChatContext } from '@/app/chat-context';
import { apiInterceptors, getAppInfo, getChatHistory, getDialogueList } from '@/client/api';
import PromptBot from '@/components/common/prompt-bot';
// import { DigitalHumanRef } from '@/components/chat/DigitalHuman/DigitalHuman';
import useChat from '@/hooks/use-chat';
import ChatContentContainer from '@/new-components/chat/ChatContentContainer';
import ChatDefault from '@/new-components/chat/content/ChatDefault';
import ChatInputPanel from '@/new-components/chat/input/ChatInputPanel';
// 移除 ChatSider 导入
import { IApp } from '@/types/app';
import { ChartData, ChatHistoryResponse, IChatDialogueSchema, UserChatContent } from '@/types/chat';
import { getInitMessage, transformFileUrl } from '@/utils';
import { useAsyncEffect, useRequest } from 'ahooks';
import { Flex, Layout, Spin, Button, message } from 'antd';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, Suspense } from 'react';

// const DigitalHuman = React.lazy(() => import('@/components/chat/DigitalHuman/DigitalHuman'));

import { DigitalHumanRef } from '@/new-components/chat/digital-human/DigitalHuman';


const DigitalHuman = React.lazy(() => import('@/new-components/chat/digital-human/DigitalHuman'));

const DbEditor = dynamic(() => import('@/components/chat/db-editor'), {
  ssr: false,
});
const ChatContainer = dynamic(() => import('@/components/chat/chat-container'), { ssr: false });

const { Content, Sider } = Layout;

interface ChatContentProps {
  history: ChatHistoryResponse; // 会话记录列表
  replyLoading: boolean; // 对话回复loading
  scrollRef: React.RefObject<HTMLDivElement>; // 会话内容可滚动dom
  canAbort: boolean; // 是否能中断回复
  chartsData: ChartData[];
  agent: string;
  currentDialogue: IChatDialogueSchema; // 当前选择的会话
  appInfo: IApp;
  temperatureValue: any;
  maxNewTokensValue: any;
  resourceValue: any;
  modelValue: string;
  setModelValue: React.Dispatch<React.SetStateAction<string>>;
  setTemperatureValue: React.Dispatch<React.SetStateAction<any>>;
  setMaxNewTokensValue: React.Dispatch<React.SetStateAction<any>>;
  setResourceValue: React.Dispatch<React.SetStateAction<any>>;
  setAppInfo: React.Dispatch<React.SetStateAction<IApp>>;
  setAgent: React.Dispatch<React.SetStateAction<string>>;
  setCanAbort: React.Dispatch<React.SetStateAction<boolean>>;
  setReplyLoading: React.Dispatch<React.SetStateAction<boolean>>;
  handleChat: (content: UserChatContent, data?: Record<string, any>) => Promise<void>; // 处理会话请求逻辑函数
  refreshDialogList: () => void;
  refreshHistory: () => void;
  refreshAppInfo: () => void;
  setHistory: React.Dispatch<React.SetStateAction<ChatHistoryResponse>>;
}
export const ChatContentContext = createContext<ChatContentProps>({
  history: [],
  replyLoading: false,
  scrollRef: { current: null },
  canAbort: false,
  chartsData: [],
  agent: '',
  currentDialogue: {} as any,
  appInfo: {} as any,
  temperatureValue: 0.5,
  maxNewTokensValue: 1024,
  resourceValue: {},
  modelValue: '',
  setModelValue: () => { },
  setResourceValue: () => { },
  setTemperatureValue: () => { },
  setMaxNewTokensValue: () => { },
  setAppInfo: () => { },
  setAgent: () => { },
  setCanAbort: () => { },
  setReplyLoading: () => { },
  refreshDialogList: () => { },
  refreshHistory: () => { },
  refreshAppInfo: () => { },
  setHistory: () => { },
  handleChat: () => Promise.resolve(),
});

const Chat: React.FC = () => {
  const { model, currentDialogInfo } = useContext(ChatContext);
  const { isContract, setIsContract, setIsMenuExpand } = useContext(ChatContext);
  const { chat, ctrl } = useChat({
    app_code: currentDialogInfo.app_code || '',
  });

  const searchParams = useSearchParams();
  const chatId = searchParams?.get('id') ?? '';
  const scene = searchParams?.get('scene') ?? '';
  const knowledgeId = searchParams?.get('knowledge_id') ?? '';
  const dbName = searchParams?.get('db_name') ?? '';

  const scrollRef = useRef<HTMLDivElement>(null);
  const order = useRef<number>(1);
  const chatInputRef = useRef<any>(null);
  const selectedPromptCodeRef = useRef<string | undefined>(undefined);

  // 数字人引用
  const digitalHumanRef = useRef<DigitalHumanRef>(null);

  const [isTTSPlaying, setIsTTSPlaying] = useState<boolean>(false);

  const [history, setHistory] = useState<ChatHistoryResponse>([]);
  const [chartsData] = useState<Array<ChartData>>();
  const [replyLoading, setReplyLoading] = useState<boolean>(false);
  const [canAbort, setCanAbort] = useState<boolean>(false);
  const [agent, setAgent] = useState<string>('');
  const [appInfo, setAppInfo] = useState<IApp>({} as IApp);
  const [temperatureValue, setTemperatureValue] = useState();
  const [maxNewTokensValue, setMaxNewTokensValue] = useState();
  const [resourceValue, setResourceValue] = useState<any>();
  const [modelValue, setModelValue] = useState<string>('');

  useEffect(() => {
    setTemperatureValue(appInfo?.param_need?.filter(item => item.type === 'temperature')[0]?.value || 0.6);
    setMaxNewTokensValue(appInfo?.param_need?.filter(item => item.type === 'max_new_tokens')[0]?.value || 4000);
    setModelValue(appInfo?.param_need?.filter(item => item.type === 'model')[0]?.value || model);
    setResourceValue(
      knowledgeId || dbName || appInfo?.param_need?.filter(item => item.type === 'resource')[0]?.bind_value,
    );
  }, [appInfo, dbName, knowledgeId, model]);

  useEffect(() => {
    // 仅初始化执行，防止dashboard页面无法切换状态
    setIsMenuExpand(scene !== 'chat_dashboard');
    // 路由变了要取消Editor模式，再进来是默认的Preview模式
    if (chatId && scene) {
      setIsContract(false);
    }
  }, [chatId, scene, setIsContract, setIsMenuExpand]);

  // 是否是默认小助手
  const isChatDefault = useMemo(() => {
    return !chatId && !scene;
  }, [chatId, scene]);

  // 获取会话列表
  // 移除 dialogueList 相关的状态管理
  // const {
  //   data: dialogueList = [],
  //   refresh: refreshDialogList,
  //   loading: listLoading,
  // } = useRequest(async () => {
  //   return await apiInterceptors(getDialogueList());
  // });

  // 获取应用详情
  const { run: queryAppInfo, refresh: refreshAppInfo } = useRequest(
    async () =>
      await apiInterceptors(
        getAppInfo({
          ...currentDialogInfo,
        }),
      ),
    {
      manual: true,
      onSuccess: data => {
        const [, res] = data;
        setAppInfo(res || ({} as IApp));
      },
    },
  );

  // 列表当前活跃对话
  const currentDialogue = useMemo(() => {
    // 由于对话列表现在由左侧边栏管理，这里返回空对象
    return {} as IChatDialogueSchema;
  }, [chatId]);

  useEffect(() => {
    const initMessage = getInitMessage();
    if (currentDialogInfo.chat_scene === scene && !isChatDefault && !(initMessage && initMessage.message)) {
      queryAppInfo();
    }
  }, [chatId, currentDialogInfo, isChatDefault, queryAppInfo, scene]);

  // 获取会话历史记录
  const {
    run: getHistory,
    loading: historyLoading,
    refresh: refreshHistory,
  } = useRequest(async () => await apiInterceptors(getChatHistory(chatId)), {
    manual: true,
    onSuccess: data => {
      const [, res] = data;
      const viewList = res?.filter(item => item.role === 'view');
      if (viewList && viewList.length > 0) {
        order.current = viewList[viewList.length - 1].order + 1;
      }
      setHistory(res || []);
    },
  });

  // 会话提问
  // 添加实时朗读相关状态
  // const lastProcessedMessageRef = useRef<string>('');
  // const realtimeProcessingRef = useRef<boolean>(false);

  // const showDigitalHuman = true; // 始终显示数字人

  const handleChat = useCallback(
    (content: UserChatContent, data?: Record<string, any>) => {
      return new Promise<void>(resolve => {
        const initMessage = getInitMessage();
        const ctrl = new AbortController();
        setReplyLoading(true);
        if (history && history.length > 0) {
          const viewList = history?.filter(item => item.role === 'view');
          const humanList = history?.filter(item => item.role === 'human');
          order.current = (viewList[viewList.length - 1]?.order || humanList[humanList.length - 1]?.order) + 1;
        }
        // Process the content based on its type
        let formattedDisplayContent: string = '';

        if (typeof content === 'string') {
          formattedDisplayContent = content;
        } else {
          // Extract content items for display formatting
          const contentItems = content.content || [];
          const textItems = contentItems.filter(item => item.type === 'text');
          const mediaItems = contentItems.filter(item => item.type !== 'text');

          // Format for display in the UI - extract text for main message
          if (textItems.length > 0) {
            // Use the text content for the main message display
            formattedDisplayContent = textItems.map(item => item.text).join(' ');
          }

          // Format media items for display (using markdown)
          const mediaMarkdown = mediaItems
            .map(item => {
              if (item.type === 'image_url') {
                const originalUrl = item.image_url?.url || '';
                // Transform the URL to a service URL that can be displayed
                const displayUrl = transformFileUrl(originalUrl);
                const fileName = item.image_url?.fileName || 'image';
                return `\n![${fileName}](${displayUrl})`;
              } else if (item.type === 'video') {
                const originalUrl = item.video || '';
                const displayUrl = transformFileUrl(originalUrl);
                return `\n[Video](${displayUrl})`;
              } else {
                return `\n[${item.type} attachment]`;
              }
            })
            .join('\n');

          // Combine text and media markup
          if (mediaMarkdown) {
            formattedDisplayContent = formattedDisplayContent + '\n' + mediaMarkdown;
          }
        }

        const tempHistory: ChatHistoryResponse = [
          ...(initMessage && initMessage.id === chatId ? [] : history),
          {
            role: 'human',
            context: formattedDisplayContent,
            model_name: data?.model_name || modelValue,
            order: order.current,
            time_stamp: 0,
          },
          {
            role: 'view',
            context: '',
            model_name: data?.model_name || modelValue,
            order: order.current,
            time_stamp: 0,
            thinking: true,
          },
        ];
        const index = tempHistory.length - 1;
        setHistory([...tempHistory]);
        // Create data object with all fields
        const apiData: Record<string, any> = {
          chat_mode: scene,
          model_name: modelValue,
          user_input: content,
        };

        // Add other data fields
        if (data) {
          Object.assign(apiData, data);
        }

        // For non-dashboard scenes, try to get prompt_code from ref or localStorage
        if (scene !== 'chat_dashboard') {
          const finalPromptCode = selectedPromptCodeRef.current || localStorage.getItem(`dbgpt_prompt_code_${chatId}`);
          if (finalPromptCode) {
            apiData.prompt_code = finalPromptCode;
            localStorage.removeItem(`dbgpt_prompt_code_${chatId}`);
          }
        }

        chat({
          data: apiData,
          ctrl,
          chatId,
          onMessage: message => {
            setCanAbort(true);
            if (data?.incremental) {
              tempHistory[index].context += message;
              tempHistory[index].thinking = false;
            } else {
              tempHistory[index].context = message;
              tempHistory[index].thinking = false;
            }
            setHistory([...tempHistory]);

            // 移除实时朗读处理，只在完成时进行朗读
          },
          // 在 onDone 回调中
          onDone: () => {
            setReplyLoading(false);
            setCanAbort(false);

            // AI回答完成后触发TTS播报
            if (tempHistory[index] && tempHistory[index].context) {
              const textContent = extractTextFromMessage(tempHistory[index].context);
              if (textContent && digitalHumanRef.current) {
                digitalHumanRef.current.setText(textContent)
                digitalHumanRef.current.speakText(textContent);
              }
            }

            // 完成时进行朗读 - 使用新的 speakAfterComplete 方法
            // if (digitalHumanRef.current) {
            //   const finalMessage = tempHistory[index].context;
            //   if (finalMessage) {
            //     console.log('大模型回答完成，开始朗读，内容长度:', finalMessage.length);
            //     digitalHumanRef.current.speakAfterComplete(finalMessage).catch(error => {
            //       console.error('完成后TTS播放失败:', error);
            //     });
            //   }
            // }

            resolve();
          },
          onClose: () => {
            setReplyLoading(false);
            setCanAbort(false);

            // 移除重复的TTS调用
            // 关闭时不再进行朗读，避免重复播放

            resolve();
          },
          onError: message => {
            setReplyLoading(false);
            setCanAbort(false);
            tempHistory[index].context = message;
            tempHistory[index].thinking = false;
            setHistory([...tempHistory]);

            resolve();
          },
        });
      });
    },
    [chatId, history, modelValue, chat, scene],
  );

  // 提取消息中的纯文本内容
  const extractTextFromMessage = (context: string): string => {
    return context.replace(/```{3,}vis-thinking[\s\S]*?```{3,}/g, '') // 移除vis-thinking代码块
      .replace(/```[\s\S]*?```/g, '') // 移除代码块
      .replace(/`[^`]*`/g, '') // 移除行内代码
      .replace(/\*\*([^*]+)\*\*/g, '$1') // 移除粗体格式
      .replace(/\*([^*]+)\*/g, '$1') // 移除斜体格式
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 移除链接格式
      .replace(/<[^>]*>/g, '') // 移除HTML标签
      .replace(/\n+/g, ' ') // 将换行替换为空格
      .trim();
  };

  useAsyncEffect(async () => {
    // 如果是默认小助手，不获取历史记录
    if (isChatDefault) {
      return;
    }
    const initMessage = getInitMessage();
    if (initMessage && initMessage.id === chatId) {
      return;
    }
    await getHistory();
  }, [chatId, scene, getHistory]);

  useEffect(() => {
    if (isChatDefault) {
      order.current = 1;
      setHistory([]);
    }
  }, [isChatDefault]);

  // 监听聊天历史变化，自动播放最新的AI回复
  // useEffect(() => {
  //   if (!showDigitalHuman || !digitalHumanRef.current || history.length === 0) {
  //     return;
  //   }

  //   // 获取最新的AI回复
  //   const latestMessage = history[history.length - 1];
  //   if (latestMessage &&
  //     latestMessage.role === 'view' &&
  //     latestMessage.context &&
  //     !latestMessage.thinking) { // 确保不是思考状态

  //     // 延迟一下再播放，确保消息已经完全显示
  //     const timer = setTimeout(() => {
  //       if (digitalHumanRef.current && latestMessage.context) {
  //         digitalHumanRef.current.speak(latestMessage.context).catch(error => {
  //           console.error('自动TTS播放失败:', error);
  //         });
  //       }
  //     }, 500);

  //     return () => clearTimeout(timer);
  //   }
  // }, [history, showDigitalHuman]);

  // 处理语音输入 - 直接填入聊天输入框
  // const handleVoiceInput = useCallback((text: string) => {
  //   if (chatInputRef.current?.setUserInput) {
  //     chatInputRef.current.setUserInput(text);
  //     message.success(`语音输入完成: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''}`);
  //   }
  // }, []);

  // 处理TTS状态变化
  // const handleTTSStatusChange = useCallback((isPlaying: boolean) => {
  //   setIsTTSPlaying(isPlaying);
  // }, []);

  const contentRender = () => {
    if (scene === 'chat_dashboard') {
      return isContract ? <DbEditor /> : <ChatContainer />;
    } else {
      return isChatDefault ? (
        <Content>
          <ChatDefault />
        </Content>
      ) : (
        <Spin spinning={historyLoading} className='w-full h-full m-auto'>
          <div className='h-screen flex flex-row flex-1'>
            {/* <div 
              className='flex bg-white'
              style={{ 
                width: '500px',
                height: '100vh'
              }}
            >
              <DigitalHuman 
                ref={digitalHumanRef}
                className=''
                onVoiceInput={handleVoiceInput}
                onTTSStatusChange={handleTTSStatusChange}
              />
            </div> */}
            {/* 数字人区域 */}
            {/* <div className='w-96 h-full flex flex-col'> */}
            <div className='w-[30vh]'>

              {/* <div className='flex-1 flex items-center justify-center pl-12'> */}
              <div className=''>
                <Suspense fallback={<h1>数字人加载中...</h1>}>
                  <DigitalHuman
                    ref={digitalHumanRef}
                    onSpeakStart={() => console.log('开始播报')}
                    onSpeakEnd={() => console.log('播报结束')}
                  />
                </Suspense>
              </div>
            </div>
            {/* 主聊天区域 - 占满整个宽度 */}
            <Content className='flex flex-col flex-1 h-full'>
              <ChatContentContainer ref={scrollRef} className='flex-1' />
              <ChatInputPanel ref={chatInputRef} ctrl={ctrl} />
            </Content>
          </div>
        </Spin>
      );
    }
  };

  return (
    <ChatContentContext.Provider
      value={{
        history,
        replyLoading,
        scrollRef,
        canAbort,
        chartsData: chartsData || [],
        agent,
        currentDialogue,
        appInfo,
        temperatureValue,
        maxNewTokensValue,
        resourceValue,
        modelValue,
        setModelValue,
        setResourceValue,
        setTemperatureValue,
        setMaxNewTokensValue,
        setAppInfo,
        setAgent,
        setCanAbort,
        setReplyLoading,
        handleChat,
        refreshDialogList: () => { }, // 空函数，因为现在由 side-bar 管理
        refreshHistory,
        refreshAppInfo,
        setHistory,
      }}
    >
      <Flex flex={1} className='bg-[url(/pictures/poc_tjsl_bg.jpg)] bg-cover bg-center'>
        <Layout className='bg-transparent '>
          {/* 移除 ChatSider 组件 */}
          <Layout className='bg-transparent'>
            {contentRender()}
            <PromptBot
              submit={prompt => {
                if (scene === 'chat_dashboard') {
                  localStorage.setItem(`dbgpt_prompt_code_${chatId}`, prompt.prompt_code);
                } else {
                  chatInputRef.current?.setUserInput?.(prompt.content);
                  selectedPromptCodeRef.current = prompt.prompt_code;
                  localStorage.setItem(`dbgpt_prompt_code_${chatId}`, prompt.prompt_code);
                }
              }}
              chat_scene={scene}
            />
          </Layout>
        </Layout>
      </Flex>
    </ChatContentContext.Provider>
  );
};

export default Chat;

