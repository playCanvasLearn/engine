import { BindingTwoWay, LabelGroup, Panel, SliderInput, VectorInput } from '@playcanvas/pcui/react';

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
            <Panel headerText='参数设置'>
                <LabelGroup text='旋转速度'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.rotateSpeed' }}
                        min={0.1}
                        max={1}
                        step={0.01}
                    />
                </LabelGroup>
                <LabelGroup text='移动速度'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.moveSpeed' }}
                        min={1}
                        max={10}
                    />
                </LabelGroup>
                <LabelGroup text='缩放速度'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.zoomSpeed' }}
                        min={0}
                        max={10}
                        step={0.001}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='双指缩放灵敏度'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.zoomPinchSens' }}
                        min={0}
                        max={10}
                        step={0.01}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='焦点阻尼'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.focusDamping' }}
                        min={0}
                        max={0.999}
                        step={0.001}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='旋转阻尼'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.rotateDamping' }}
                        min={0}
                        max={0.999}
                        step={0.001}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='移动阻尼'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.moveDamping' }}
                        min={0}
                        max={0.999}
                        step={0.001}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='缩放阻尼'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.zoomDamping' }}
                        min={0}
                        max={0.999}
                        step={0.001}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='俯仰角范围'>
                    <VectorInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.pitchRange' }}
                        dimensions={2}
                    />
                </LabelGroup>
                <LabelGroup text='偏航角范围'>
                    <VectorInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.yawRange' }}
                        dimensions={2}
                    />
                </LabelGroup>
                <LabelGroup text='缩放范围'>
                    <VectorInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.zoomRange' }}
                        dimensions={2}
                    />
                </LabelGroup>
                <LabelGroup text='最小缩放比例'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'attr.zoomScaleMin' }}
                        min={0}
                        max={1}
                        step={0.001}
                        precision={3}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
