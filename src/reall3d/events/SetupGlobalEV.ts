// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { AudioLoader, AudioListener, Audio } from 'three';
import { GetBgAudio, PlaytBgAudio, SetBgAudioVolumeDown, SetBgAudioVolumeUp, StopBgAudio } from '../events/EventConstants';
import { loadFile } from '../modeldata/loaders/FileLoader';
import { loopByTime } from '../utils/CommonUtils';
import { Events } from './Events';

/**
 * 全局性的单例事件对象，在此写全局性的通用控制，可在 UI、Viewer、SplatMesh 之间自由穿梭畅通无阻，简洁高效的实现各种功能。
 */
export const globalEv: Events = (() => {
    const ev = new Events();
    ev.on(PlaytBgAudio, async (urlAudio: string = '', isLoop: boolean = false, volume: number = 0.5): Promise<boolean> => {
        const audioBg = getBackgroundAudio();

        let reslove: Function = null;
        new Promise(rs => (reslove = rs));

        if (audioBg.isPlaying) {
            reslove(true);
            return;
        }

        const mp3Bytes: any = await loadFile(urlAudio || 'https://reall3d.com/demo-models/demo/background1.mp3');
        const mp3Url = URL.createObjectURL(new Blob([mp3Bytes], { type: 'application/octet-stream' }));
        new AudioLoader().load(
            mp3Url,
            buf => {
                audioBg.setBuffer(buf);
                audioBg.setLoop(isLoop);
                audioBg.setVolume(volume);
                audioBg.play();
                reslove(true);
            },
            () => reslove(false),
        );
    });

    ev.on(StopBgAudio, () => {
        const audioBg = getBackgroundAudio(false);
        if (!audioBg?.isPlaying) return;
        audioBg.stop();
    });

    ev.on(SetBgAudioVolumeDown, () => {
        const audioBg = getBackgroundAudio();
        if (!audioBg.isPlaying) return;

        let vol = audioBg.getVolume();
        loopByTime(
            () => audioBg?.setVolume((vol = Math.max(vol * 0.99, 0.15))),
            () => vol > 0.15,
        );
    });
    ev.on(SetBgAudioVolumeUp, () => {
        const audioBg = getBackgroundAudio();
        if (!audioBg.isPlaying) return;

        let vol = audioBg.getVolume();
        loopByTime(
            () => audioBg?.setVolume((vol = Math.min(vol * 1.01, 0.5))),
            () => vol < 0.5,
        );
    });

    function getBackgroundAudio(autoCreate = true): Audio {
        let audioBg: Audio = ev.fire(GetBgAudio);
        if (!audioBg && autoCreate) {
            audioBg = new Audio(new AudioListener());
            ev.on(GetBgAudio, () => audioBg);
        }
        return audioBg;
    }

    return ev;
})();
