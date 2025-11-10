// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
export interface MarkData {
    /** 类型 */
    type?: 'MarkDistanceLine' | 'MarkSinglePoint' | 'MarkMultiLines' | 'MarkMultiPlans' | 'MarkCirclePlan' | 'MarkSingleTag' | undefined;
    /** 名称（样式类名等标识用） */
    name?: string;
}
