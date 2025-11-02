// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Audio, AudioListener, AudioLoader } from 'three';
import { globalEv } from '../events/GlobalEV';
import { SetBgAudioVolumeDown, SetBgAudioVolumeUp } from '../events/EventConstants';

export class AudioText {
    private audio: Audio;
    private autoPlay: boolean;
    private mp3: string;
    private textDurations: any[];

    public constructor(autoPlay: boolean = false, mp3: string = '', textDurations: any[] = []) {
        this.autoPlay = autoPlay;
        this.mp3 = mp3;
        const copyTextDurations = [];
        for (const textDuration of textDurations) {
            copyTextDurations.push([...textDuration]);
        }
        this.textDurations = copyTextDurations;
    }

    public play(force: boolean = false): void {
        if (!force && !this.autoPlay) return;
        if (this.audio) return;

        const audio = new Audio(new AudioListener());
        this.audio = audio;
        const audioLoader = new AudioLoader();
        audioLoader.load(this.mp3, (buf: AudioBuffer) => {
            globalEv.fire(SetBgAudioVolumeDown);
            setTimeout(async () => {
                audio.setBuffer(buf);
                audio.setLoop(false);
                audio.setVolume(1.0);
                audio.play();

                for (const textDuration of this.textDurations) {
                    const text: string = textDuration[0];
                    const duration: number = textDuration[1];
                    const rs = await this.showAudioText(text, duration);
                    if (!rs) break;
                }
                globalEv.fire(SetBgAudioVolumeUp);
            }, 500);
        });
    }

    private showAudioText(txt: string, duration: number): Promise<boolean> {
        let div: HTMLDivElement = document.querySelector('.tv-text');
        if (!div) {
            const divContainer = document.createElement('div');
            divContainer.style.cssText = `position:fixed;bottom:30px;left:0;right:0;display:flex;justify-content:center;z-index:99;pointer-events:none;`;
            div = document.createElement('div');
            div.style.cssText = `background-color:#333;opacity:0.8;color:white;font-size:32px;padding:2px 10px;border-radius:4px;max-width:90%;text-align:center;user-select:none;`;
            divContainer.append(div);
            document.body.append(divContainer);
        }

        return new Promise(res => {
            if (div) {
                div.innerText = txt;
                div.style.display = 'block';
            }
            setTimeout(() => {
                div.style.display = 'none';
                div.innerText = '';
                if (this.audio?.isPlaying) {
                    setTimeout(() => res(true), 200);
                } else {
                    res(false);
                }
            }, duration);
        });
    }

    public dispose(): void {
        this.audio?.stop();
        this.audio = null;
        this.mp3 = null;
        this.textDurations = null;
    }
}
