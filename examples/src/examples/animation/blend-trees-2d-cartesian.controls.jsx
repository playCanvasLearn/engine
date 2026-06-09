import React from 'react';

export function Controls({ observer }) {
    const [jogToggle, setJogToggle] = React.useState(observer.get('jogToggle') === true);

    React.useEffect(() => {
        setJogToggle(observer.get('jogToggle') === true);
        const handle = observer.on('jogToggle:set', (value) => {
            setJogToggle(value === true);
        });
        return () => handle?.unbind?.();
    }, [observer]);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px'
            }}
        >
            <div style={{ fontSize: '12px', opacity: 0.8,color: '#ffffff' }}>
                鼠标左键点击场景地面可移动人物
            </div>
            <button
                onClick={() => observer.emit('poseIdle')}
            >
                动作-静止
            </button>
            <button
                onClick={() => observer.emit('poseEager')}
            >
                动作-渴望
            </button>
            <button
                onClick={() => observer.emit('poseWalk')}
            >
                动作-走路
            </button>
            <button
                onClick={() => observer.emit('poseWalkEager')}
            >
                动作-走路+渴望
            </button>
            <button
                onClick={() => observer.emit('poseDance')}
            >
                动作-跳舞
            </button>
            <button
                onClick={() => observer.emit('jump')}
            >
                跳跃
            </button>
            <label
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: '#ffffff',
                    gap: '8px'
                }}
            >
                <input
                    type="checkbox"
                    checked={jogToggle}
                    onChange={(event) => {
                        const checked = event.target.checked;
                        setJogToggle(checked);
                        observer.set('jogToggle', checked);
                    }}
                />
                跑步移动
            </label>
            <button
                onClick={() => observer.emit('stop')}
            >
                停止移动
            </button>
        </div>
    );
}
