// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Camera, Group, Quaternion, Renderer, Scene, Vector3 } from 'three';
import { CSS3DObject } from 'three/examples/jsm/Addons.js';
import { Events } from '../../events/Events';
import {
    AddMarkToWeakRef,
    DeleteMarkWeakRef,
    GetCamera,
    GetControls,
    GetOptions,
    GetRenderer,
    MarkFinish,
    OnViewerBeforeUpdate,
    StopAutoRotate,
    TraverseDisposeAndClear,
    ViewerNeedUpdate,
} from '../../events/EventConstants';
import { MarkData } from './data/MarkData';
import { MarkData3DSingleTag } from './data/MarkData3DSingleTag';
import { Reall3dMapViewerOptions } from '../../mapviewer/Reall3dMapViewerOptions';

export class Mark3DSingleTag extends Group {
    public readonly isMark: boolean = true;
    private disposed: boolean = false;
    private events: Events;
    private data: MarkData3DSingleTag;
    private css3dTag: CSS3DObject;

    constructor(events: Events, obj: Vector3 | MarkData3DSingleTag, name?: string) {
        super();
        this.events = events;
        const that = this;

        let data: MarkData3DSingleTag;
        if (obj instanceof Vector3) {
            const cnt: number = document.querySelectorAll('.mark-wrap-point').length + 1;
            data = {
                type: 'Mark3DSingleTag',
                name: name || 'tag' + Date.now(),
                point: obj.toArray(),
                iconName: '#svgicon-chakan',
                iconColor: '#eeee00',
                iconOpacity: 0.8,
                mainTagColor: '#c4c4c4',
                mainTagBackground: '#2E2E30',
                mainTagOpacity: 0.8,
                title: '标签' + cnt,
                note: '',
            };
        } else {
            data = {
                type: 'Mark3DSingleTag',
                name: obj.name || 'tag' + Date.now(),
                point: [...obj.point],
                iconName: obj.iconName || '#svgicon-jieshuo',
                iconColor: obj.iconColor || '#eeee00',
                iconOpacity: obj.iconOpacity || 0.8,
                mainTagColor: obj.mainTagColor || '#c4c4c4',
                mainTagBackground: obj.mainTagBackground || '#2E2E30',
                mainTagOpacity: obj.mainTagOpacity || 0.8,
                title: obj.title || '标签',
                note: obj.note || '',
            };
        }

        const tagWarp: HTMLDivElement = document.createElement('div');
        tagWarp.innerHTML = `<div class="mark-3dgs-tag3d-warp" >
                                <div class="tag-icon-3dgs icon1 enable" title="视频欣赏">
                                  <svg height="20" width="20" class="${data.name}"><use href="#svgicon-shiping" fill="currentColor" /></svg>
                                </div>
                               <div class="tag-icon-3dgs icon1 enable" title="语音解说">
                                  <svg height="20" width="20" class="${data.name}"><use href="#svgicon-jieshuo" fill="currentColor" /></svg>
                                </div>
                                <div class="tag-icon-3dgs icon2 enable" title="详细查看">
                                  <svg height="20" width="20" class="${data.name}"><use href="#svgicon-chakan" fill="currentColor" /></svg>
                                </div>
                            </div>`;
        tagWarp.classList.add('mark-wrap3d-tag', `mark-wrap3d-${data.name}`);
        tagWarp.style.position = 'absolute';
        tagWarp.style.borderRadius = '4px';
        tagWarp.querySelectorAll('.tag-icon-3dgs').forEach(dom => {
            dom.addEventListener('click', e => {
                if (events.fire(GetOptions).markMode) return;
                console.info((e.target as HTMLDivElement).title, that.getMarkData());
            });
        });
        tagWarp.oncontextmenu = (e: MouseEvent) => e.preventDefault();
        tagWarp.onwheel = (e: WheelEvent) => events.fire(GetControls)._onMouseWheel(e);

        const css3dTag = new CSS3DObject(tagWarp);
        css3dTag.position.set(data.point[0], data.point[1], data.point[2]);
        css3dTag.element.style.pointerEvents = 'none';
        css3dTag.scale.set(0.02, 0.02, 0.02);
        css3dTag.rotation.x = Math.PI;

        that.data = data;
        that.css3dTag = css3dTag;
        that.add(css3dTag);
        events.fire(AddMarkToWeakRef, that);
    }

    /**
     * 绘制更新
     */
    public drawUpdate(data?: MarkData3DSingleTag, saveData: boolean = true) {
        if (this.disposed) return;
        const that = this;

        if (data?.iconName) {
            saveData && (that.data.iconName = data.iconName);
            const svg: SVGElement = this.css3dTag.element.querySelector(`.mark-wrap-${that.data.name} svg`);
            svg.innerHTML = `<use href="${data.iconName}" fill="currentColor" />`;
        }
        if (data?.iconColor) {
            saveData && (that.data.iconColor = data.iconColor);
            const svg: SVGElement = this.css3dTag.element.querySelector(`.mark-wrap-${that.data.name} svg`);
            svg.style.color = data.iconColor;
        }
        if (data?.iconOpacity) {
            saveData && (that.data.iconOpacity = data.iconOpacity);
            const svg: SVGElement = this.css3dTag.element.querySelector(`.mark-wrap-${that.data.name} svg`);
            svg.style.opacity = data.iconOpacity.toString();
        }
        if (data?.mainTagColor) {
            saveData && (that.data.mainTagColor = data.mainTagColor);
            (this.css3dTag.element.querySelector(`.${that.data.name}`) as HTMLSpanElement).style.color = data.mainTagColor;
        }
        if (data?.mainTagBackground) {
            saveData && (that.data.mainTagBackground = data.mainTagBackground);
            (this.css3dTag.element.querySelector(`.${that.data.name}`) as HTMLSpanElement).style.background = data.mainTagBackground;
        }
        if (data?.mainTagOpacity) {
            saveData && (that.data.mainTagOpacity = data.mainTagOpacity);
            (this.css3dTag.element.querySelector(`.${that.data.name}`) as HTMLSpanElement).style.opacity = data.mainTagOpacity.toString();
        }
        if (data?.title !== undefined) {
            saveData && (that.data.title = data.title);
            (this.css3dTag.element.querySelector(`.${that.data.name}`) as HTMLSpanElement).innerText = data.title;
        }
        if (data?.note !== undefined) {
            saveData && (that.data.note = data.note);
        }

        that.events.fire(ViewerNeedUpdate);
    }

    public resetMeterScale(markData: any) {
        if (markData?.meterScale === undefined) return;
        this.events.fire(GetOptions).meterScale = markData.meterScale;
    }

    /**
     * 绘制结束
     */
    public drawFinish() {
        if (this.disposed) return;
        const that = this;
        that.events.fire(MarkFinish);

        // @ts-ignore
        const onActiveMark = parent?.onActiveMark;
        const data: any = that.getMarkData(true);
        data.isNew = true;
        data.meterScale = that.events.fire(GetOptions).meterScale;
        onActiveMark?.(data);
    }

    public getMarkData(simple: boolean = false): MarkData {
        const data: MarkData3DSingleTag = { ...this.data };
        if (simple) {
            delete data.point;
        } else {
            data.point = [...data.point];
        }
        return data;
    }

    public dispose() {
        if (this.disposed) return;
        const that = this;
        that.disposed = true;

        that.events.fire(TraverseDisposeAndClear, that);
        that.removeFromParent();
        that.events.fire(DeleteMarkWeakRef, that);

        const wrap: HTMLDivElement = document.querySelector(`.mark-wrap3d-${that.data.name}`);
        wrap?.parentElement?.removeChild?.(wrap);

        that.events = null;
        that.data = null;
        that.css3dTag = null;
    }
}
