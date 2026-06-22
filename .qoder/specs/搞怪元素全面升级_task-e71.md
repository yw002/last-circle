# 世界极致丰富计划

## Context
当前世界已有7种树木、200房屋、3条河流、湖泊、草地、天气系统、18种动物、火山、敌人等。用户希望极致丰富世界内容，涵盖：5大生物群落、6种新建筑、动态天象系统、互动世界元素四大类别。

---

## Task 1: 群落基础设施 (biomes.js + config.js + state.js)

**新建:** `src/world/biomes.js`
**修改:** `src/config.js`, `src/state.js`

- Voronoi 5种子点手动布局（西南沙漠/东南雪地/北部丛林/西北沼泽/东北熔岩）
- 预计算 600x600 群落查找表（10单位/格），`getBiomeAt(x,z)` O(1)查表
- `getBiomeBlendFactor(x,z)` 返回相邻群落混合因子，用于200单位过渡带
- config.js 新增 `BIOME_CONFIG` 常量（5种群落ID/颜色/属性）
- state.js 新增 `biomeMap`、`vehicles`、`campfires`、`destructibles`、`barrels`、`airdrops`、`fishingSpots`、`dayNightTime` 字段

## Task 2: 地形群落集成 (terrain.js 修改)

**修改:** `src/world/terrain.js`

- `getBaseTerrainHeight()` 增加群落修正：沙漠沙丘（平滑正弦）、雪地冰川谷、沼泽极低水洼、熔岩崎岖黑曜石、丛林微增起伏
- `initTerrain()` 顶点着色替换为群落感知：沙漠沙色/雪地白/丛林深绿/沼泽绿褐/熔岩黑+熔岩发光
- 群落边界通过 `getBiomeBlendFactor()` 实现颜色渐变过渡
- 保留现有道路叠加逻辑

## Task 3: 五大群落植被系统

**新建:** `src/world/biomeDesert.js`, `src/world/biomeSnow.js`, `src/world/biomeJungle.js`, `src/world/biomeSwamp.js`, `src/world/biomeLava.js`

- **沙漠**: 200棵仙人掌(共享几何体)、80棵枯树、100个风纹沙丘、30个骷髅骨头
- **雪地**: 250棵雪松(松树+白色覆盖)、8个冰冻湖面、150个雪堆、60个冰柱
- **丛林**: 400棵巨型蕨类(GPU instanced)、200条藤蔓、50棵巨型树(scale 2-3x)、局部浓雾
- **沼泽**: 30个毒水池、120个巨型蘑菇(红/紫)、100棵扭曲枯树、毒伤区(每秒-5HP)
- **熔岩**: 5条熔岩河(emissive发光)、2000烟雾粒子、80个岩石柱、火焰伤害区(每秒-15HP)
- 所有对象使用 `registerStaticObject()` + 碰撞体推入 `state.colliders`

## Task 4: 草地+环境群落集成 (grass.js + environment.js 修改)

**修改:** `src/world/grass.js`, `src/world/environment.js`

- grass.js: fragment shader 新增 `instanceBiome` 属性，按群落切换颜色（沙漠枯黄/雪地白/丛林深绿/沼泽暗/熔岩焦黑）
- grass.js: `collectPositions()` 按群落调整密度（沙漠跳过80%/丛林0%/沼泽50%/熔岩95%/雪地60%）
- environment.js: `initTrees()` 按群落过滤树类型（沙漠=枯树/雪地=松树/丛林=橡树竹林/沼泽=柳树/熔岩=极少）
- environment.js: `initRocks()` 按群落调整岩石材质颜色

## Task 5: 六种新建筑类型

**新建:** `src/world/buildings.js`

- **军事基地(3个)**: 铁丝网围墙+集装箱(军绿色)+雷达塔+武器箱，高品质战利品
- **古遗迹(5个)**: 石柱(部分倾斜)+断拱+雕像+金色宝箱，特殊武器掉落
- **灯塔(2个)**: 水边高塔(白+红条纹)+玻璃灯室+旋转SpotLight光束(夜间联动)
- **桥梁(8个)**: 跨河木桥/石拱桥，桥面 `standable: true` 碰撞体
- **矿井入口(3个)**: 木质框架洞口+铁轨+矿车+发光灯笼(PointLight)
- **农场(5个)**: 风车(叶片旋转)+红色谷仓+围栏+干草堆掩体
- 全部遵循: Group → Box3碰撞 → registerStaticObject → spawnLoot 模式

## Task 6: 动态天象系统

**新建:** `src/systems/dayNight.js`, `src/systems/skyEffects.js`

- **日夜循环(600秒一周期)**: 太阳绕Y轴旋转+天空颜色渐变(日出橙→白天蓝→日落红→夜晚暗)+光照强度正弦变化
- **月亮+星空**: 月亮SphereGeometry(80)与太阳对称、3000颗星Points系统(夜间alpha=1/白天alpha=0)
- **极光**: 北方(z<-1000)高空3-5条波浪PlaneGeometry，ShaderMaterial绿紫蓝渐变，仅夜间可见
- **萤火虫**: 500粒子Points(沼泽/丛林夜间)，黄绿发光随机飘动
- **落叶**: 300粒子(桦树/樱花树附近)，橙红黄色缓慢飘落
- **鸟群V阵型**: 5-7只剪影ConeGeometry，每60-120秒横跨天空

## Task 7: 互动世界元素

**新建:** `src/world/interactables.js`, `src/systems/destructibles.js`

- **篝火(30个)**: 木柴堆+火焰Points+PointLight(0xFF6600)，半径20单位内每秒+10HP
- **爆炸桶(80个)**: 红色圆柱体，射击爆炸→半径25伤害+链式反应(100ms延迟)
- **钓鱼点(20个)**: 水边涟漪标记，按E钓鱼(2秒等待→随机物品/鱼+50HP)
- **木箱(100个)**: 被子弹破坏→掉落弹药/医疗包
- **围栏(200个)**: 碰撞破碎，主要在农场/军事基地

## Task 8: 载具系统

**新建:** `src/world/vehicles.js`
**修改:** `src/entities/player.js`, `src/systems/controls.js`, `src/state.js`

- **吉普车(15辆)**: BoxGeometry车身+4轮，散布道路交叉点
- **摩托车(10辆)**: 更小模型，散布路边
- **进入/退出**: 距离<8按E进入→隐藏玩家→摄像机跟随→WASD驾驶(速度2-3x)→按E退出
- 载具有血量，被射击可损坏
- controls.js 新增 KeyE 绑定

## Task 9: 空投系统

**新建:** `src/systems/airdrop.js`

- 每90秒或每减20人触发
- 飞机(BoxGeometry简化)从地图一侧飞到另一侧，高度500
- 释放降落伞空投箱(金色+SphereGeometry半球伞)
- 落地后红色烟柱标记(远处可见)
- 内含稀有战利品(特殊武器+3级装备)
- audio.js 新增引擎音效

## Task 10: 现有系统适配 + main.js集成

**修改:** `src/systems/weather.js`, `src/systems/collision.js`, `src/systems/spatial.js`, `src/entities/player.js`, `src/ui/minimap.js`, `src/main.js`

- weather.js: 光照/天空颜色乘以日夜因子
- collision.js: 桥梁 `standable: true` 特殊处理
- spatial.js: 新增 interactables/vehicles 网格
- player.js: 沼泽毒伤+熔岩火伤+篝火治疗+载具进出+钓鱼+桶爆炸检测
- minimap.js: 群落底色+新建筑图标+空投降落位置
- main.js: init() 中按序调用所有新系统初始化，animate() 中新增 runFrameStep 调用

## 实施顺序
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9 → Task 10

## 验证
1. `npx vite build` 确认无编译错误
2. 群落查找表性能：`getBiomeAt()` 在 600x600 网格上 O(1)
3. 新增碰撞体总数 < 5000，spatial.js CELL_SIZE=300 查询效率不退化
4. 日夜循环与天气系统不冲突（dayNight先运行，weather叠加）
5. 载具进出/退出状态正确恢复
6. 群落边界植被/颜色过渡平滑（200单位混合带）
7. 所有新建筑内部有战利品生成
