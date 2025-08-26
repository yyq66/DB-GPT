import { ChatContext } from '@/app/chat-context';
import { DarkSvg, SunnySvg, ModelSvg } from '@/components/icons';
import UserBar from '@/new-components/layout/UserBar';
import { STORAGE_LANG_KEY, STORAGE_THEME_KEY, STORAGE_USERINFO_KEY } from '@/utils/constants/index';
import Icon, { 
  GlobalOutlined, 
  MenuFoldOutlined, 
  MenuUnfoldOutlined, 
  PlusOutlined,
  AppstoreOutlined,
  ForkOutlined,
  ConsoleSqlOutlined,
  PartitionOutlined,
  BuildOutlined,
  MessageOutlined,
  SettingOutlined,
  CommentOutlined
} from '@ant-design/icons';
import { Popover, Tooltip, MenuProps, Button, Dropdown } from 'antd';
import cls from 'classnames';
import moment from 'moment';
import 'moment/locale/zh-cn';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiInterceptors, getDialogueList, newDialogue } from '@/client/api';
import { useRequest } from 'ahooks';
import { IChatDialogueSchema } from '@/types/chat';

// 引入 ChatSider 组件
import ChatSider from '@/new-components/chat/sider/ChatSider';
// 引入 AppDefaultIcon 组件
import AppDefaultIcon from '@/new-components/common/AppDefaultIcon';

type SettingItem = {
  key: string;
  name: string;
  icon: ReactNode;
  noDropdownItem?: boolean;
  onClick?: () => void;
  items?: MenuProps['items'];
  onSelect?: (p: { key: string }) => void;
  defaultSelectedKeys?: string[];
  placement?: 'top' | 'topLeft';
};

type RouteItem = {
  key: string;
  name: string;
  icon: ReactNode;
  path: string;
  isActive?: boolean;
};

// TODO: unused function
// function menuItemStyle(active?: boolean) {
//   return `flex items-center h-12 hover:bg-[#F1F5F9] dark:hover:bg-theme-dark text-base w-full transition-colors whitespace-nowrap px-4 ${
//     active ? 'bg-[#F1F5F9] dark:bg-theme-dark' : ''
//   }`;
// }

function smallMenuItemStyle(active?: boolean) {
  return `flex items-center justify-center mx-auto rounded w-14 h-14 text-xl hover:bg-[#F1F5F9] dark:hover:bg-theme-dark transition-colors cursor-pointer ${
    active ? 'bg-[#F1F5F9] dark:bg-theme-dark' : ''
  }`;
}

function SideBar() {
  const { isMenuExpand, setIsMenuExpand, mode, setMode, adminList } = useContext(ChatContext);
  const { pathname } = useRouter();
  const { t, i18n } = useTranslation();
  const order = useRef<number>(1);
  const router = useRouter();

  // 获取会话列表
  const {
    data: dialogueList = [],
    refresh: refreshDialogList,
    loading: listLoading,
  } = useRequest(async () => {
    return await apiInterceptors(getDialogueList());
  });

  const hasAdmin = useMemo(() => {
    const { user_id } = JSON.parse(localStorage.getItem(STORAGE_USERINFO_KEY) || '{}');
    return adminList.some(admin => admin.user_id === user_id);
  }, [adminList]);

  // 获取与展开状态一致的会话列表数据 - 移到组件顶层
  const chatItems = useMemo(() => {
    const list = dialogueList[1] || [];
    return list.map((item: IChatDialogueSchema) => ({
      ...item,
      label: item.user_input || item.select_param || '新会话',
      key: item.conv_uid,
      icon: <AppDefaultIcon scene={item.chat_mode} />,
    }));
  }, [dialogueList]);

  // 应用管理路由配置
  const routes = useMemo(() => {
    const items: RouteItem[] = [
      {
        key: 'app',
        name: t('App'),
        path: '/construct/app',
        icon: <AppstoreOutlined />,
      },
      {
        key: 'flow',
        name: t('awel_flow'),
        icon: <ForkOutlined />,
        path: '/construct/flow',
      },
      {
        key: 'models',
        name: t('model_manage'),
        path: '/construct/models',
        icon: <Icon component={ModelSvg} />,
      },
      {
        key: 'database',
        name: t('Database'),
        icon: <ConsoleSqlOutlined />,
        path: '/construct/database',
      },
      {
        key: 'knowledge',
        name: t('Knowledge_Space'),
        icon: <PartitionOutlined />,
        path: '/construct/knowledge',
      },
      {
        key: 'prompt',
        name: t('Prompt'),
        icon: <MessageOutlined />,
        path: '/construct/prompt',
      },
      {
        key: 'dbgpts',
        name: 'DBGPTS社区',
        path: '/construct/dbgpts',
        icon: <BuildOutlined />,
      },
    ];
    return items;
  }, [t]);

  const handleToggleMenu = useCallback(() => {
    setIsMenuExpand(!isMenuExpand);
  }, [isMenuExpand, setIsMenuExpand]);

  const handleToggleTheme = useCallback(() => {
    const theme = mode === 'light' ? 'dark' : 'light';
    setMode(theme);
    localStorage.setItem(STORAGE_THEME_KEY, theme);
  }, [mode, setMode]);

  const handleChangeLang = useCallback(() => {
    const language = i18n.language === 'en' ? 'zh' : 'en';
    i18n.changeLanguage(language);
    if (language === 'zh') moment.locale('zh-cn');
    if (language === 'en') moment.locale('en');
    localStorage.setItem(STORAGE_LANG_KEY, language);
  }, [i18n]);

  // 创建新会话的处理函数 - Move this here, before it's used
  const handleCreateNewChat = useCallback(async () => {
    try {
      const [err, data] = await apiInterceptors(
        newDialogue({
          chat_mode: 'chat_normal',
          model: 'chatgpt_proxyllm',
        })
      );
      
      if (!err && data) {
        // 刷新会话列表
        refreshDialogList();
        // 跳转到新创建的会话
        router.push(`/`);
      }
    } catch (error) {
      console.error('创建会话失败:', error);
    }
  }, [refreshDialogList, router]);

  const settings = useMemo(() => {
    const items: SettingItem[] = [
      {
        key: 'theme',
        name: t('Theme'),
        icon: mode === 'dark' ? <Icon component={DarkSvg} /> : <Icon component={SunnySvg} />,
        items: [
          {
            key: 'light',
            label: (
              <div className='py-1 flex justify-between gap-8 '>
                <span className='flex gap-2 items-center'>
                  <Image src='/pictures/theme_light.png' alt='english' width={38} height={32}></Image>
                  <span>Light</span>
                </span>
                <span
                  className={cls({
                    block: mode === 'light',
                    hidden: mode !== 'light',
                  })}
                >
                  ✓
                </span>
              </div>
            ),
          },
          {
            key: 'dark',
            label: (
              <div className='py-1 flex justify-between gap-8 '>
                <span className='flex gap-2 items-center'>
                  <Image src='/pictures/theme_dark.png' alt='english' width={38} height={32}></Image>
                  <span>Dark</span>
                </span>
                <span
                  className={cls({
                    block: mode === 'dark',
                    hidden: mode !== 'dark',
                  })}
                >
                  ✓
                </span>
              </div>
            ),
          },
        ],
        onClick: handleToggleTheme,
        onSelect: ({ key }: { key: string }) => {
          if (mode === key) return;
          setMode(key as 'light' | 'dark');
          localStorage.setItem(STORAGE_THEME_KEY, key);
        },
        defaultSelectedKeys: [mode],
        placement: 'topLeft',
      },
      {
        key: 'language',
        name: t('language'),
        icon: <GlobalOutlined />,
        items: [
          {
            key: 'en',
            label: (
              <div className='py-1 flex justify-between gap-8 '>
                <span className='flex gap-2'>
                  <Image src='/icons/english.png' alt='english' width={21} height={21}></Image>
                  <span>English</span>
                </span>
                <span
                  className={cls({
                    block: i18n.language === 'en',
                    hidden: i18n.language !== 'en',
                  })}
                >
                  ✓
                </span>
              </div>
            ),
          },
          {
            key: 'zh',
            label: (
              <div className='py-1 flex justify-between gap-8 '>
                <span className='flex gap-2'>
                  <Image src='/icons/zh.png' alt='english' width={21} height={21}></Image>
                  <span>简体中文</span>
                </span>
                <span
                  className={cls({
                    block: i18n.language === 'zh',
                    hidden: i18n.language !== 'zh',
                  })}
                >
                  ✓
                </span>
              </div>
            ),
          },
        ],
        onSelect: ({ key }: { key: string }) => {
          if (i18n.language === key) return;
          i18n.changeLanguage(key);
          if (key === 'zh') moment.locale('zh-cn');
          if (key === 'en') moment.locale('en');
          localStorage.setItem(STORAGE_LANG_KEY, key);
        },
        onClick: handleChangeLang,
        defaultSelectedKeys: [i18n.language],
      },
      {
        key: 'fold',
        name: t(isMenuExpand ? 'Close_Sidebar' : 'Show_Sidebar'),
        icon: isMenuExpand ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />,
        onClick: handleToggleMenu,
        noDropdownItem: true,
      },
    ];
    return items;
  }, [t, mode, handleToggleTheme, i18n, handleChangeLang, isMenuExpand, handleToggleMenu, setMode]);

  const functions = useMemo(() => {
    const items: RouteItem[] = [
      {
        key: 'chat',
        name: t('chat_online'),
        icon: (
          <Image
            key='image_chat'
            src={pathname === '/chat' ? '/pictures/chat_active.png' : '/pictures/chat.png'}
            alt='chat_image'
            width={40}
            height={40}
          />
        ),
        path: '/chat',
        isActive: pathname.startsWith('/chat'),
      },
      {
        key: 'explore',
        name: t('explore'),
        isActive: pathname === '/',
        icon: (
          <Image
            key='image_explore'
            src={pathname === '/' ? '/pictures/explore_active.png' : '/pictures/explore.png'}
            alt='construct_image'
            width={40}
            height={40}
          />
        ),
        path: '/',
      },
      {
        key: 'construct',
        name: t('construct'),
        isActive: pathname.startsWith('/construct'),
        icon: (
          <Image
            key='image_construct'
            src={pathname.startsWith('/construct') ? '/pictures/app_active.png' : '/pictures/app.png'}
            alt='construct_image'
            width={40}
            height={40}
          />
        ),
        path: '/construct/app',
      },
    ];
    if (hasAdmin) {
      items.push({
        key: 'evaluation',
        name: '场景评测',
        icon: (
          <Image
            key='image_construct'
            src={pathname.startsWith('/evaluation') ? '/pictures/app_active.png' : '/pictures/app.png'}
            alt='construct_image'
            width={40}
            height={40}
          />
        ),
        path: '/evaluation',
        isActive: pathname === '/evaluation',
      });
    }
    return items;
  }, [t, pathname, hasAdmin]);

  useEffect(() => {
    const language = i18n.language;
    if (language === 'zh') moment.locale('zh-cn');
    if (language === 'en') moment.locale('en');
  }, []);


  if (!isMenuExpand) {
    // 应用管理下拉菜单项
    const appManageMenuItems = routes.map(route => ({
      key: route.key,
      label: (
        <Link href={route.path} className="flex items-center px-2 py-1 text-sm">
          <span className="mr-2">{route.icon}</span>
          <span>{route.name}</span>
        </Link>
      ),
    }));

    // 设置下拉菜单项
    const settingsMenuItems = [
      {
        key: 'theme',
        label: (
          <div className="flex items-center px-2 py-1 text-sm" onClick={handleToggleTheme}>
            <span className="mr-2">{mode === 'dark' ? <Icon component={DarkSvg} /> : <Icon component={SunnySvg} />}</span>
            <span>{t('Theme')}</span>
          </div>
        ),
      },
      {
        key: 'language',
        label: (
          <div className="flex items-center px-2 py-1 text-sm" onClick={handleChangeLang}>
            <span className="mr-2"><GlobalOutlined /></span>
            <span>{t('language')}</span>
          </div>
        ),
      },
    ];


    //收起UI界面
    return (
      <div className='flex flex-col justify-between pt-4 h-screen bg-bar dark:bg-[#232734] animate-fade animate-duration-300 w-24'>
        <div className='flex flex-col items-center flex-1 min-h-0'>
          {/* LOGO */}
          <Link href='/' className='flex justify-center items-center pb-5'>
            <Image src='/zhuoshi_logo.png' alt='DB-GPT' width={55} height={55} />
          </Link>
          
          {/* 圆形蓝色+号新建会话按钮 */}
          <Tooltip title="创建会话" placement='right'>
            <div 
              className='w-14 h-14 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center cursor-pointer transition-colors mb-4'
              onClick={handleCreateNewChat}
            >
              <PlusOutlined className='text-white text-lg' />
            </div>
          </Tooltip>
          
          {/* 会话聊天记录列表 - 与展开状态保持一致 */}
          <div className='flex-1 w-full overflow-hidden'>
            {chatItems && chatItems.length > 0 ? (
              <div className='flex flex-col space-y-2 h-full scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600'>
                {chatItems.map((item: any, index: number) => (
                  <Popover
                    key={item.conv_uid}
                    content={
                      <div className='max-w-xs p-2'>
                        <div className='text-xs text-gray-600 dark:text-gray-400 break-words'>
                          {item.label}
                        </div>
                      </div>
                    }
                    placement='right'
                    trigger='hover'
                  >
                    <Link href={`/chat?scene=${item.chat_mode}&id=${item.conv_uid}`}>
                      <div className={`w-14 h-14 flex items-center justify-center mx-auto rounded-lg transition-colors cursor-pointer ${
                        pathname.startsWith('/chat') && router.query.id === item.conv_uid
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        <AppDefaultIcon scene={item.chat_mode} />
                      </div>
                    </Link>
                  </Popover>
                ))}
              </div>
            ) : (
              <Tooltip title="聊天记录" placement='right'>
                <Link href='/chat'>
                  <div className={`w-14 h-14 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                    pathname.startsWith('/chat') 
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    <CommentOutlined className='text-xl' />
                  </div>
                </Link>
              </Tooltip>
            )}
          </div>
        </div>
        
        {/* 底部控制栏 - 竖立的三个按钮 */}
        <div className='flex flex-col items-center pb-4 space-y-3 flex-shrink-0'>
          {/* 应用管理按钮 */}
          <Dropdown 
            menu={{ items: appManageMenuItems }} 
            placement='topLeft'
            trigger={['hover']}
          >
            <Tooltip title="应用管理" placement='right'>
              <div className={`w-14 h-14 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                pathname.startsWith('/construct') || pathname.startsWith('/knowledge')
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                <AppstoreOutlined className='text-xl' />
              </div>
            </Tooltip>
          </Dropdown>
          
          {/* 设置按钮 */}
          <Dropdown 
            menu={{ items: settingsMenuItems }} 
            placement='topLeft'
            trigger={['hover']}
          >
            <Tooltip title="设置" placement='right'>
              <div className='w-14 h-14 flex items-center justify-center rounded-lg transition-colors cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'>
                <SettingOutlined className='text-xl' />
              </div>
            </Tooltip>
          </Dropdown>
          
          {/* 收起/展开按钮 */}
          <Tooltip title={t('Show_Sidebar')} placement='right'>
            <div 
              className='w-14 h-14 flex items-center justify-center rounded-lg transition-colors cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              onClick={handleToggleMenu}
            >
              <MenuUnfoldOutlined className='text-xl' />
            </div>
          </Tooltip>
        </div>
      </div>
    );
  }

  //展开状态
  return (
    <div
      className='flex flex-col justify-between h-screen px-4 pt-2 bg-bar dark:bg-[#232734] animate-fade animate-duration-300'
    >
      <div className='flex-1 flex flex-col min-h-0'>
        {/* LOGO */}
        <Link href='/' className='flex items-center p-2 pb-4'>
          <Image src='/banner_logo.webp' alt='DB-GPT' width={200} height={40} />
        </Link>
        
        {/* 创建会话按钮 */}
        <div className='mb-4'>
          <Button 
            type='primary' 
            icon={<PlusOutlined />} 
            onClick={handleCreateNewChat}
            className='w-full h-11 flex items-center justify-center text-sm font-medium'
            size='middle'
          >
            {t('create_conversation')}
          </Button>
        </div>
        
        {/* ChatSider 组件 - 放在创建会话按钮下方 */}
        <div className='flex-1 overflow-hidden'>
          <ChatSider
            dialogueList={dialogueList}
            listLoading={listLoading}
            historyLoading={false}
            order={order}
            refresh={refreshDialogList}
          />
        </div>
      </div>

      {/* 底部固定区域 - 应用管理和设置 */}
      <div className='flex-shrink-0'>
        {/* 应用管理列表 */}
        <div className='border-t border-gray-200 dark:border-gray-700 pt-4'>
          <div className='max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600'>
            <div className='space-y-1'>
              {routes.map(route => (
                <Link key={route.key} href={route.path}>
                  <div className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    pathname.startsWith(route.path) ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    <span className='mr-3 text-base'>{route.icon}</span>
                    <span className='flex-1'>{route.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className='pt-4'>
          <div className='flex items-center justify-around py-4 mt-2 border-t border-dashed border-gray-200 dark:border-gray-700'>
            {settings.map(item => (
              <div key={item.key}>
                <Popover content={item.name}>
                  <div className='flex-1 flex items-center justify-center cursor-pointer text-xl' onClick={item.onClick}>
                    {item.icon}
                  </div>
                </Popover>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SideBar;
