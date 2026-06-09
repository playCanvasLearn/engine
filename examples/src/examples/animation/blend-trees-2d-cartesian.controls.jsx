import React from 'react';

export function Controls({ observer }) {

    const playAnim = (name) => {
        observer.set('animName', name);
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px'
            }}
        >
            <button
                onClick={() =>
                    observer.set('data.pos', {
                        x: -0.5,
                        y: 0.5
                    })
                }
            >
                静止
            </button>

            <button
                onClick={() =>
                    observer.set('data.pos', {
                        x: 0.5,
                        y: 0.5
                    })
                }
            >
                渴望
            </button>

            <button
                onClick={() =>
                    observer.set('data.pos', {
                        x: 0.5,
                        y: -0.5
                    })
                }
            >
                走路
            </button>
            <button
                onClick={() =>
                    observer.set('data.pos', {
                        x: 0.5,
                        y: 0
                    })
                }
            >
                走路+渴望
            </button>
            <button
                onClick={() =>
                    observer.set('data.pos', {
                        x: -0.5,
                        y: -0.5
                    })
                }
            >
                跳舞
            </button>
        </div>
    );
}