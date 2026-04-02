// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Events } from '../events/Events';

// 个性化自定义处理
export function setupCustomUtils(events: Events) {
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);
}
