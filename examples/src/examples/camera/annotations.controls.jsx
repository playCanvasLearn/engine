import { BindingTwoWay, BooleanInput, ColorPicker, LabelGroup, Panel, SliderInput } from '@playcanvas/pcui/react';

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
            <Panel headerText='标注'>
                <LabelGroup text='显示文字介绍'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.showIntro' }}
                    />
                </LabelGroup>
                <LabelGroup text='显示尺寸线与标签'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.showLines' }}
                    />
                </LabelGroup>
                <LabelGroup text='标注点大小'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.hotspotSize' }}
                        min={10}
                        max={50}
                    />
                </LabelGroup>
                <LabelGroup text='标注点颜色'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.hotspotColor' }}
                    />
                </LabelGroup>
                <LabelGroup text='悬停颜色'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.hoverColor' }}
                    />
                </LabelGroup>
                <LabelGroup text='不透明度'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.opacity' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='背面不透明度'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.behindOpacity' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
