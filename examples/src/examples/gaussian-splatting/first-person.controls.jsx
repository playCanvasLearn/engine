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
