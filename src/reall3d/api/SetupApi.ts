// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Events } from '../events/Events';
import { HttpPostMetaData, HttpQueryGaussianText } from '../events/EventConstants';
import { ViewerVersion } from '../utils/consts/GlobalConstants';
import { MetaData } from '../modeldata/MetaData';
export function setupApi(events: Events) {
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);

    on(HttpPostMetaData, (meta: MetaData) => {
        // TODO post meta data to server here
        const url = meta.url;
        const metaClone: MetaData = { ...meta };
        delete metaClone.url;
        const metaJson = JSON.stringify(metaClone, null, 2);
        console.info(metaJson);
    });

    on(HttpQueryGaussianText, (text: string = '', fmt = '') => {
        const url = 'https://reall3d.com/gsfont/api/getGaussianText';
        const formData = new FormData();
        formData.append('text', text.substring(0, 100)); // 限制查取最大100字
        formData.append('fmt', fmt);
        formData.append('ver', ViewerVersion);
        formData.append('tk', sessionStorage.getItem('tk-gstext') || '');

        return new Promise(resolve => {
            fetch(url, { method: 'POST', body: formData })
                .then(response => (response.ok ? response.json() : {}))
                .then((data: any) => (data.success ? resolve(JSON.parse(data.data)) : resolve([])))
                .catch(e => resolve([]));
        });
    });
}
