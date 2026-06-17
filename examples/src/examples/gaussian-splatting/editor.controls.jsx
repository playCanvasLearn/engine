import {
    BindingTwoWay,
    LabelGroup,
    SelectInput,
    SliderInput,
    Button,
    Panel
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
           {/*  <Panel headerText='渲染器'>
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
            </Panel> */}
            <Panel headerText='编辑设置'>
                <Button text='选择场景复制' onClick={() => observer.emit('select')} />
                <LabelGroup text='选择框大小'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'boxSize' }}
                        min={0.1}
                        max={5.0}
                        precision={2}
                    />
                </LabelGroup>
                <Button text='删除所选' onClick={() => observer.emit('deleteSelected')} />
                <Button text='克隆所选' onClick={() => observer.emit('cloneSelected')} />
            </Panel>
        </>
    );
}
