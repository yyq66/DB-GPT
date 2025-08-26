import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { Preset, Project, Global, Human } from "metamaker-human-card-kit";
import { Button, Space } from 'antd';
import { PlayCircleOutlined, StopOutlined } from '@ant-design/icons';

const TOKEN = "AW 3caa80d331ed4816b8aa002bde87ea55:MTc1NDYzMTc2NDrbpIX2Bw06etMX5+UEzzBxZJA0m1huZK9ruLbUChhqrA==";

// 定义暴露给父组件的方法接口
export interface DigitalHumanRef {
    setText: (text: string) => void;
    speakText: (text: string) => Promise<void>;
    stop: () => void;
}

interface DigitalHumanProps {
    width?: number;
    height?: number;
    className?: string;
    autoSpeak?: boolean; // 是否自动播报新消息
    onSpeakStart?: () => void;
    onSpeakEnd?: () => void;
}

const DigitalHuman = forwardRef<DigitalHumanRef, DigitalHumanProps>((
    {
        onSpeakStart,
        onSpeakEnd
    },
    ref
) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const animationIdRef = useRef<number | null>(null);

    const humanRef = useRef<Human | null>(null); // 添加数字人引用
    const currentTTSStateRef = useRef<any>(null); // 当前播报状态引用

    const [text, setText] = useState("你好，我是你的数字人助手！");
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);


    // 数字人播放
    const speakText = (text: string): Promise<void> => {
        if (!humanRef.current || !text.trim()) {
            return Promise.resolve();
        }
        
        return new Promise<void>((resolve, reject) => {
            const performSpeak = async () => {
                try {
                    setIsPlaying(true);
                    setIsPaused(false);
                    onSpeakStart?.();
                    console.log('text:', text);
    
                    // 使用数字人的 speak 方法
                    const state = await humanRef.current!.speak({
                        text: text,
                        isSmartAction: true,
                        tts:{"speed":50,"volume":50,"voice_name":"zh-CN-YunyangNeural"},
                        ttsExtra: {
                            is_strict: false,
                            disable_censor: true,
                        }
                    });
                    console.log('state:', state);
                    
                    currentTTSStateRef.current = state;
                    
                    // 监听播报完成事件
                    state.addEventListener('finished', () => {
                        setIsPlaying(false);
                        setIsPaused(false);
                        currentTTSStateRef.current = null;
                        onSpeakEnd?.();
                        resolve(); // 播放完成时 resolve Promise
                    });
                    
                    // 监听播报错误事件
                    state.addEventListener('error', (error: any) => {
                        setIsPlaying(false);
                        setIsPaused(false);
                        currentTTSStateRef.current = null;
                        onSpeakEnd?.();
                        reject(error); // 播放错误时 reject Promise
                    });
                    
                } catch (error) {
                    console.error('播放失败:', error);
                    setIsPlaying(false);
                    setIsPaused(false);
                    currentTTSStateRef.current = null;
                    onSpeakEnd?.();
                    reject(error);
                }
            };
            
            performSpeak();
        });
    };

    // 停止播报
    const stop = async () => {
        if (humanRef.current && isPlaying) {
            try {
                // 通过设置动画来中断播报
                await humanRef.current.setMainAnimationNameImmediateEffective('anim/Anim_daiji_M01');
                setIsPlaying(false);
                setIsPaused(false);
                currentTTSStateRef.current = null;
                onSpeakEnd?.();
            } catch (error) {
                console.error('停止播报失败:', error);
            }
        }
    };

    // 数字人初始化逻辑
    useEffect(() => {
        if (!TOKEN) {
            console.warn("请设置 TOKEN 后再继续");
            return;
        }

        // 创建场景组件
        let camera: THREE.PerspectiveCamera;
        let scene: THREE.Scene;
        let human: Human;
        let project: Project;
        const clock = new THREE.Clock();

        const init = async () => {
            try {
                // 初始化项目和渲染器
                project = await Project.create(TOKEN);
                rendererRef.current = Preset.PresetRenderer.create();
                scene = new THREE.Scene();

                // 初始化相机和光照
                camera = Preset.PresetCamera.create(Preset.CameraMode.Panorama);
                Preset.PresetLights.createAndPutScene(scene);

                // 项目中加载数字人模型
                human = await project.loadHuman();
                humanRef.current = human; // 保存数字人引用
                await humanRef.current.setMainAnimationNameImmediateEffective('anim/Anim_daiji_M01');
                scene.add(human);
                

                // 挂载到DOM
                if (containerRef.current && rendererRef.current) {
                    containerRef.current.appendChild(rendererRef.current.domElement);
                }

                handleResize(); // 设置初始大小
                animate();  // 开始动画循环
            } catch (error) {
                console.error("数字人初始化失败:", error);
            }
        };

        const handleResize = () => {
            if (rendererRef.current && camera && containerRef.current) {
                const container = containerRef.current;
                const containerWidth = container.clientWidth;
                // 设置为窗口高度
                const containerHeight = window.innerHeight;

                rendererRef.current.setSize(containerWidth, containerHeight);
                camera.aspect = containerWidth / containerHeight;
                camera.updateProjectionMatrix();
            }
        };

        const animate = () => {
            animationIdRef.current = requestAnimationFrame(animate);
            const delta = clock.getDelta();
            if (human) human.update(delta);
            if (rendererRef.current && camera && scene) {
                rendererRef.current.render(scene, camera);
            }
        };

        init();

        const resizeObserver = new ResizeObserver(handleResize);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
            }

            resizeObserver.disconnect();

            if (rendererRef.current && rendererRef.current.domElement && containerRef.current?.contains(rendererRef.current.domElement)) {
                containerRef.current.removeChild(rendererRef.current.domElement);
            }

            if (rendererRef.current) {
                rendererRef.current.dispose();
            }
        };
    }, []);

    // 对外提供的方法
    useImperativeHandle(ref, () => ({
        setText,
        speakText,
        stop,
    }));

    return (
        <div className={`digital-human-container`}>
            {/* 数字人渲染区域 */}
            <div ref={containerRef} style={{ width: '100%', height: `100%`, minWidth: '352px' }} />

            {/* 播放暂停按钮 */}
            {/* <div className="p-4">
                <Space className="w-full justify-center">
                    {!isPlaying ? (
                        // 未播放时只显示播放按钮
                        <Button
                            type="primary"
                            icon={<PlayCircleOutlined />}
                            onClick={() => speakText(text)}
                            disabled={!text.trim()}
                        >
                        </Button>
                    ) : (
                        // 播放时显示停止按钮
                        <Button
                            danger
                            type="primary"
                            icon={<StopOutlined />}
                            onClick={stop}
                        >
                        </Button>
                    )}
                </Space>
            </div> */}
        </div>
    );
});

DigitalHuman.displayName = 'DigitalHuman';

export default DigitalHuman;
