import {
    BindingTwoWay,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput,
    Label
} from '@playcanvas/pcui/react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    return (
        <>
{/*             <Panel headerText='设置'>
                <LabelGroup text='渲染器'>
                    <SelectInput
                        type='number'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'renderer' }}
                        value={observer.get('renderer') ?? 0}
                        options={[
                            { v: 0, t: '自动' },
                            { v: 1, t: '光栅（CPU 排序）' },
                            { v: 2, t: '光栅（GPU 排序）' },
                            { v: 3, t: '计算' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Splat 预算（百万）'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'splatBudget' }}
                        min={0}
                        max={10}
                        precision={2}
                        step={0.05}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='相机'>
                <LabelGroup text='距离'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'cameraDistance' }}
                        min={1}
                        max={15}
                        precision={2}
                        step={0.1}
                    />
                </LabelGroup>
                <LabelGroup text='高度'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'cameraHeight' }}
                        min={0}
                        max={4}
                        precision={2}
                        step={0.05}
                    />
                </LabelGroup>
                <LabelGroup text='平滑'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'cameraSmoothing' }}
                        min={0}
                        max={0.01}
                        precision={5}
                        step={0.0001}
                    />
                </LabelGroup>
                <LabelGroup text='视角灵敏度'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lookSens' }}
                        min={0.01}
                        max={0.5}
                        precision={3}
                        step={0.005}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='统计'>
                <LabelGroup text='分辨率'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.resolution' }}
                        value={observer.get('data.stats.resolution')}
                    />
                </LabelGroup>
                <LabelGroup text='GSplat 数量'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.gsplats' }}
                        value={observer.get('data.stats.gsplats')}
                    />
                </LabelGroup>
            </Panel> */}
        </>
    );
}
