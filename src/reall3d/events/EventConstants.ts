// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
let i = 1;

/** 帧率循环调用 */
export const RunLoopByFrame = i++;
/** 定时循环调用 */
export const RunLoopByTime = i++;
/** 提交元数据到服务器 */
export const HttpPostMetaData = i++;
/** 取文本高斯数据 */
export const HttpQueryGaussianText = i++;
/** 计算平面中心点 */
export const ComputePlansCenter = i++;
/** 计算多个平面的面积 */
export const ComputePlansArea = i++;
/** 按数据重新计算多个平面的面积 */
export const ReComputePlansArea = i++;
/** 计算三角面的面积 */
export const ComputePoint3Area = i++;
/** 取得相关对象 */
export const GetWorker = i++;
/** 取得相关对象 */
export const GetCanvas = i++;

/** 取得相关对象 */
export const GetCamera = i++;
/** 取得相关对象 */
export const GetControls = i++;
/** 取得当前相机参数信息 */
export const GetCameraInfo = i++;
/** 设定相机视点 */
export const CameraSetLookAt = i++;
/** 取相机视点 */
export const GetCameraLookAt = i++;
/** 取相机上向量 */
export const GetCameraLookUp = i++;
/** 取相机位置 */
export const GetCameraPosition = i++;
/** 取相机Fov */
export const GetCameraFov = i++;
/** 控制器更新 */
export const ControlsUpdate = i++;
/** 控制器更新旋转轴 */
export const ControlsUpdateRotateAxis = i++;

/** 取视图投影矩阵数组 */
export const GetViewProjectionMatrixArray = i++;
/** 取视图投影矩阵 */
export const GetViewProjectionMatrix = i++;
/** 排序 */
export const WorkerSort = i++;
/** 销毁 */
export const WorkerDispose = i++;
/** 销毁 */
export const EventListenerDispose = i++;
/** 编码 base64 */
export const EncodeBase64 = i++;
/** 解码 base64 */
export const DecodeBase64 = i++;
/** 开始自动旋转 */
export const StartAutoRotate = i++;
/** 停止自动旋转 */
export const StopAutoRotate = i++;
/** 加载模型开始 */
export const LoaderModelStart = i++;

/** 渲染信息 */
export const Information = i++;
/** 当前时点限制渲染的的高斯点数(包含了附加的动态文字水印数) */
export const GetMaxRenderCount = i++;
/** 渲染帧率 */
export const ComputeFps = i++;
/** Splat全局变量 */
export const CreateSplatUniforms = i++;
/** Splat几何体 */
export const CreateSplatGeometry = i++;
/** Splat材质 */
export const CreateSplatMaterial = i++;
/** Splat网格 */
export const CreateSplatMesh = i++;
/** 取Splat几何体 */
export const GetSplatGeometry = i++;
/** 取Splat材质 */
export const GetSplatMaterial = i++;
/** Splat更新焦距 */
export const SplatUpdateFocal = i++;

/** Splat更新视口 */
export const SplatUpdateViewport = i++;
/** Splat更新索引缓冲数据 */
export const SplatUpdateSplatIndex = i++;
/** Splat更新纹理 */
export const SplatUpdateTexture = i++;
/** Splat更新使用中索引 */
export const SplatUpdateUsingIndex = i++;
/** Splat更新点云模式 */
export const SplatUpdatePointMode = i++;
/** Splat更新场景模式 */
export const SplatUpdateBigSceneMode = i++;
/** Splat更新亮度系数 */
export const SplatUpdateLightFactor = i++;
/** Splat更新中心高点 */
export const SplatUpdateTopY = i++;
/** Splat更新可见半径 */
export const SplatUpdateCurrentVisibleRadius = i++;
/** Splat更新光圈半径 */
export const SplatUpdateCurrentLightRadius = i++;

/** Splat更新标记点 */
export const SplatUpdateMarkPoint = i++;
/** Splat更新系统时间 */
export const SplatUpdatePerformanceNow = i++;
/** Splat更新水印显示与否 */
export const SplatUpdateShowWaterMark = i++;
/** Splat更新调试效果 */
export const SplatUpdateDebugEffect = i++;
/** Splat更新球谐系数级别 */
export const SplatUpdateShDegree = i++;
/** Splat几何体销毁 */
export const SplatGeometryDispose = i++;
/** Splat材质销毁 */
export const SplatMaterialDispose = i++;
/** 默认渲染帧率计数器更新 */
export const CountFpsDefault = i++;
/** 默认渲染帧率 */
export const GetFpsDefault = i++;
/** 真实渲染帧率计数器更新 */
export const CountFpsReal = i++;

/** 真实渲染帧率 */
export const GetFpsReal = i++;
/** 销毁 */
export const ViewerUtilsDispose = i++;
/** 销毁 */
export const CommonUtilsDispose = i++;
/** 取得渲染器选项 */
export const GetOptions = i++;
/** 画布尺寸 */
export const GetCanvasSize = i++;
/** 取渲染器 */
export const GetRenderer = i++;
/** 取场景 */
export const GetScene = i++;
/** 渲染器销毁 */
export const ViewerDispose = i++;
/** 是否相机视角发生变化需要渲染 */
export const IsCameraChangedNeedUpdate = i++;
/** 是否相机视角发生变化需要重新加载数据 */
export const IsCameraChangedNeedLoadData = i++;

/** 是否大场景模式 */
export const IsBigSceneMode = i++;
/** 是否点云模式 */
export const IsPointcloudMode = i++;
/** 是否调试模式 */
export const IsDebugMode = i++;
/** 添加模型 */
export const SplatTexdataManagerAddModel = i++;
/** 数据是否有变化（大场景用） */
export const SplatTexdataManagerDataChanged = i++;
/** 销毁 */
export const SplatTexdataManagerDispose = i++;
/** 销毁 */
export const SplatMeshDispose = i++;
/** 切换显示模式（通常仅小场景使用） */
export const SplatMeshSwitchDisplayMode = i++;
/** 小场景渐进加载（圆圈扩大） */
export const SplatMeshCycleZoom = i++;
/** 转字符串 */
export const Vector3ToString = i++;

/** 模型文件下载开始 */
export const OnFetchStart = i++;
/** 模型文件下载中 */
export const OnFetching = i++;
/** 模型文件下载结束 */
export const OnFetchStop = i++;
/** 是否加载中（小场景适用） */
export const IsFetching = i++;
/** 数据上传就绪的渲染数（小场景适用） */
export const OnTextureReadySplatCount = i++;
/** 数据是否已下载结束并准备就绪（小场景适用） */
export const IsSmallSceneRenderDataReady = i++;
/** 是否可以更新纹理 */
export const CanUpdateTexture = i++;
/** 检查执行键盘按键动作处理 */
export const KeyActionCheckAndExecute = i++;
/** 视线轴旋转 */
export const RotateAt = i++;
/** 视线轴左旋 */
export const RotateLeft = i++;

/** 视线轴右旋 */
export const RotateRight = i++;
/** 取活动点数据 */
export const GetSplatActivePoints = i++;
/** 射线拾取点 */
export const RaycasterRayIntersectPoints = i++;
/** 射线与点的距离 */
export const RaycasterRayDistanceToPoint = i++;
/** 调整视点为拾取点 */
export const SelectPointAndLookAt = i++;
/** 标注选点 */
export const SelectMarkPoint = i++;
/** 清除标注选点 */
export const ClearMarkPoint = i++;
/** 取焦点标记材质 */
export const GetFocusMarkerMaterial = i++;
/** 刷新焦点标记网格 */
export const FocusMarkerUpdate = i++;
/** 取相机方向 */
export const GetCameraDirection = i++;

/** 焦点标记材质设定透明度 */
export const FocusMarkerSetOpacity = i++;
/** 焦点标记更新缩放比例 */
export const FocusMarkerUpdateScale = i++;
/** 焦点标记自动消失 */
export const FocusMarkerAutoDisappear = i++;
/** 控制平面 */
export const GetControlPlane = i++;
/** 控制平面显示控制 */
export const ControlPlaneSwitchVisible = i++;
/** 控制平面刷新 */
export const ControlPlaneUpdate = i++;
/** 控制平面是否可见 */
export const IsControlPlaneVisible = i++;
/** 渲染前处理 */
export const OnViewerBeforeUpdate = i++;
/** 渲染处理 */
export const OnViewerUpdate = i++;
/** 渲染后处理 */
export const OnViewerAfterUpdate = i++;

/** 设定水印文字 */
export const OnSetWaterMark = i++;
/** 取当前缓存的水印文字 */
export const GetCachedWaterMark = i++;
/** 通知渲染器需要刷新 */
export const NotifyViewerNeedUpdate = i++;
/** 通知渲染器需要刷新 */
export const ViewerNeedUpdate = i++;
/** 更新渲染器选项的点云模式 */
export const ViewerSetPointcloudMode = i++;
/** 渲染器检查是否需要刷新 */
export const ViewerCheckNeedUpdate = i++;
/** 渲染器设定Splat点云模式 */
export const SplatSetPointcloudMode = i++;
/** 渲染器切换Splat显示模式 */
export const SplatSwitchDisplayMode = i++;
/** 取标注包裹元素 */
export const GetMarkWarpElement = i++;
/** 取CSS3DRenderer */
export const GetCSS3DRenderer = i++;

/** 销毁 */
export const CSS3DRendererDispose = i++;
/** 添加标注弱引用缓存 */
export const AddMarkToWeakRef = i++;
/** 从弱引用缓存取标注对象 */
export const GetMarkFromWeakRef = i++;
/** 删除标注弱引用缓存 */
export const DeleteMarkWeakRef = i++;
/** 按数据更新指定名称的标注 */
export const UpdateMarkByName = i++;
/** 按米比例尺更新全部标注 */
export const UpdateAllMarkByMeterScale = i++;
/** 按名称取标注数据 */
export const GetMarkDataByName = i++;
/** 标注点 */
export const MarkPoint = i++;
/** 标注线 */
export const MarkLine = i++;
/** 标注面 */
export const MarkPlan = i++;

/** 标注距离 */
export const MarkDistance = i++;
/** 标注面积 */
export const MarkArea = i++;
/** 标注结束 */
export const MarkFinish = i++;
/** 标注更新可见状态 */
export const MarkUpdateVisible = i++;
/** 标注数据保存 */
export const MetaMarkSaveData = i++;
/** 保存小场景相机信息 */
export const MetaSaveSmallSceneCameraInfo = i++;
/** 标注数据删除 */
export const MetaMarkRemoveData = i++;
/** 保存水印 */
export const MetaSaveWatermark = i++;
/** 加载小场景元数据(相机初始化，标注待激活显示) */
export const LoadSmallSceneMetaData = i++;
/** 遍历销毁并清空Object3D的子对象 */
export const TraverseDisposeAndClear = i++;

/** 取消当前正在进行的标注 */
export const CancelCurrentMark = i++;
/** 取高斯文本 */
export const GetGaussianText = i++;
/** 设定高斯文本 */
export const SetGaussianText = i++;
/** 取相机飞行轨迹 */
export const GetFlyPositions = i++;
/** 取相机飞行轨迹（数组形式，用于存盘） */
export const GetFlyPositionArray = i++;
/** 取相机飞行视点轨迹（数组形式，用于存盘） */
export const GetFlyTargetArray = i++;
/** 添加相机飞行轨迹点 */
export const AddFlyPosition = i++;
/** 保存相机飞行轨迹点 */
export const FlySavePositions = i++;
/** 清空相机飞行轨迹点 */
export const ClearFlyPosition = i++;
/** 设定相机飞行轨迹 */
export const OnSetFlyPositions = i++;

/** 设定相机飞行视点轨迹 */
export const OnSetFlyTargets = i++;
/** 相机飞行控制 */
export const Flying = i++;
/** 相机飞行控制(仅一次) */
export const FlyOnce = i++;
/** 允许相机飞行控制 */
export const FlyEnable = i++;
/** 禁止相机飞行控制 */
export const FlyDisable = i++;
/** 取SplatMesh实例 */
export const GetSplatMesh = i++;
/** 打印信息（开发调试用） */
export const PrintInfo = i++;
/** 上传纹理 */
export const UploadSplatTexture = i++;
/** 上传纹理完成 */
export const UploadSplatTextureDone = i++;
/** 球谐系数纹理高度 */
export const GetShTexheight = i++;

/** Splat更新球谐系数纹理(1,2级) */
export const SplatUpdateSh12Texture = i++;
/** Splat更新球谐系数纹理(3级) */
export const SplatUpdateSh3Texture = i++;
/** 模型数据的球谐系数级别 */
export const GetModelShDegree = i++;
/** 当前以多少球谐系数级别在显示 */
export const GetCurrentDisplayShDegree = i++;
/** 取模型包围盒中心点 */
export const GetAabbCenter = i++;
/** 聚焦包围盒中心点 */
export const FocusAabbCenter = i++;
/** 渲染obj模型 */
export const OnLoadAndRenderObj = i++;
/** 取内存中的元数据 */
export const GetMeta = i++;
/** Splat更新标记 */
export const SplatUpdateFlagValue = i++;
/** Splat更新活动标记 */
export const SplatUpdateActiveFlagValue = i++;

/** 取元数据中配置的矩阵 */
export const GetMetaMatrix = i++;
/** 更新包围盒数据 */
export const SplatUpdateBoundBox = i++;
/** 更新包围盒数据 */
export const SplatSetBoundBoxVisible = i++;
/** 更新包围球半径 */
export const SplatUpdateMaxRadius = i++;
/** Splat更新动作时间 */
export const SplatUpdatePerformanceAct = i++;
/** 小场景显示完成 */
export const OnSmallSceneShowDone = i++;
/** 小场景粒子效果加载模式（0，1，2） */
export const SplatUpdateParticleMode = i++;
/** 更新最小最大像素直径限制 */
export const SplatUpdateMinMaxPixelDiameter = i++;
/** 更新最低可渲染透明度(0~255) */
export const SplatUpdateMinAlpha = i++;
/** 更新是否使用近似计算替代exp的标记 */
export const SplatUpdateUseSimilarExp = i++;

/** 更新质量级别 */
export const OnQualityLevelChanged = i++;
/** 小场景开始时间变迁效果 */
export const OnSmallSceneTimeChange = i++;
/** 更新渲染质量级别 */
export const UpdateQualityLevel = i++;
/** 更新Worker相关参数 */
export const WorkerUpdateParams = i++;
/** Splat更新特效类型 */
export const SplatUpdateTransitionEffect = i++;
/** SplatMesh是否已创建 */
export const IsSplatMeshCreated = i++;

/** 创建地图渲染器 */
export const MapCreateRenderer = i++;
/** 创建地图场景 */
export const MapCreateScene = i++;
/** 创建地图相机 */
export const MapCreateCamera = i++;
/** 创建地图控制器 */
export const MapCreateControls = i++;

/** 创建光源 */
export const MapCreateDirLight = i++;
/** 取一个活动的splatMesh实例(仅用于地图单个高斯模型调整) */
export const MapGetSplatMesh = i++;
/** 按X轴旋转 */
export const MapSplatMeshRotateX = i++;
/** 按Y轴旋转 */
export const MapSplatMeshRotateY = i++;
/** 按Z轴旋转 */
export const MapSplatMeshRotateZ = i++;
/** 按X轴平移 */
export const MapSplatMeshMoveX = i++;
/** 按Y轴平移 */
export const MapSplatMeshMoveY = i++;
/** 按Z轴平移 */
export const MapSplatMeshMoveZ = i++;
/** 设定位置 */
export const MapSplatMeshSetPosition = i++;
/** 缩放 */
export const MapSplatMeshScale = i++;

/** 切换显示隐藏 */
export const MapSplatMeshShowHide = i++;
/** 保存模型矩阵 */
export const MapSplatMeshSaveModelMatrix = i++;
/** 对多个SplatMesh实例的渲染顺序进行排序 */
export const MapSortSplatMeshRenderOrder = i++;
/** 遍历并清空销毁场景中的所有对象 */
export const MapSceneTraverseDispose = i++;
/** 飞向目标 */
export const MapFlyToTarget = i++;

/** 相机飞行控制 */
export const TweenFly = i++;
/** 相机飞行控制(仅一次) */
export const TweenFlyOnce = i++;
/** 允许相机飞行控制 */
export const TweenFlyEnable = i++;
/** 禁止相机飞行控制 */
export const TweenFlyDisable = i++;
/** 飞行暂停 */
export const FlyingPause = i++;

/** 飞行继续 */
export const FlyingContinue = i++;
/** 飞行播放 */
export const FlyingPlay = i++;
/** 取设定的渲染质量级别(1~9) */
export const GetRenderQualityLevel = i++;
/** 取设定的排序类型 */
export const GetSortType = i++;
/** 更新排序类型 */
export const UpdateSortType = i++;

// 以下全局单例事件对象使用
/** 取背景音乐对象 */
export const GetBgAudio = i++;
/** 播放背景音乐 */
export const PlaytBgAudio = i++;
/** 背景音乐音量渐进调小 */
export const SetBgAudioVolumeDown = i++;
/** 背景音乐音量渐进调大 */
export const SetBgAudioVolumeUp = i++;
/** 停止背景音乐 */
export const StopBgAudio = i++;
