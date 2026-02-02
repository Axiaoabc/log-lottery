<script setup lang="ts">
import { ref, onMounted, onUnmounted, } from 'vue'
import PrizeList from './PrizeList.vue'
import { useElementStyle, useElementPosition } from '@/hooks/useElement'
import StarsBackground from '@/components/StarsBackground/index.vue'
import confetti from 'canvas-confetti'
import { filterData, selectCard, splitArraysByOrdinarys } from '@/utils'
import { rgba } from '@/utils/color'
import { IPersonConfig } from '@/types/storeType'
// import * as THREE from 'three'
import { Scene, PerspectiveCamera, Object3D, Vector3 } from 'three'
// import {
//     CSS3DRenderer, CSS3DObject
// } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { CSS3DRenderer, CSS3DObject } from 'three-css3d'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
// import TrackballControls from 'three-trackballcontrols';
// import TWEEN from 'three/examples/jsm/libs/tween.module.js';
import * as TWEEN from '@tweenjs/tween.js'
import useStore from '@/store'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toast-notification';
import 'vue-toast-notification/dist/theme-sugar.css';
import { excludedUserIds } from '@/store/data'

const toast = useToast();
const router = useRouter()
const personConfig = useStore().personConfig
const globalConfig = useStore().globalConfig
const prizeConfig = useStore().prizeConfig

const { getAllPersonList: allPersonList, getNotPersonList: notPersonList, getNotThisPrizePersonList: notThisPrizePersonList } = storeToRefs(personConfig)
const { getCurrentPrize: currentPrize } = storeToRefs(prizeConfig)
const { getTopTitle: topTitle, getCardColor: cardColor, getPatterColor: patternColor, getPatternList: patternList, getTextColor: textColor, getLuckyColor: luckyColor, getCardSize: cardSize, getTextSize: textSize, getRowCount: rowCount } = storeToRefs(globalConfig)
const tableData = ref<any[]>([])
// const tableData = ref<any[]>(JSON.parse(JSON.stringify(alreadyPersonList.value)).concat(JSON.parse(JSON.stringify(notPersonList.value))))
const currentStatus = ref(0) // 0为初始状态， 1为抽奖准备状态，2为抽奖中状态，3为抽奖结束状态
const ballRotationY = ref(0)
const containerRef = ref<HTMLElement>()
// const LuckyViewRef= ref()
const canOperate = ref(true)
const cameraZ = ref(3000)

const scene = ref()
const camera = ref()
const renderer = ref()
const controls = ref()
const objects = ref<any[]>([])

const targets = {
    grid: <any[]>[],
    helix: <any[]>[],
    table: <any[]>[],
    sphere: <any[]>[]
};

const luckyTargets = ref<any[]>([])
const luckyCardList = ref<number[]>([])
let luckyCount = ref(10)
const personPool = ref<IPersonConfig[]>([])

const noLuckyPersonList = ['144', '115', '110', '108', '94', '23', '81', '22', '128']


const intervalTimer = ref<any>(null)
// const currentPrizeValue = ref(JSON.parse(JSON.stringify(currentPrize.value)))

// 填充数据，填满七行
function initTableData() {
    if (allPersonList.value.length <= 0) {
        return
    }
    const totalCount = rowCount.value * 7
    const orginPersonData = JSON.parse(JSON.stringify(allPersonList.value))
    const orginPersonLength = orginPersonData.length
    if (orginPersonLength < totalCount) {
        const repeatCount = Math.ceil(totalCount / orginPersonLength)
        // 复制数据
        for (let i = 0; i < repeatCount; i++) {
            tableData.value = tableData.value.concat(JSON.parse(JSON.stringify(orginPersonData)))
        }
    }
    else {
        tableData.value = orginPersonData.slice(0, totalCount)
    }
    tableData.value = filterData(tableData.value.slice(0, totalCount), rowCount.value)
}
const init = () => {
    const felidView = 40;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    const nearPlane = 1;
    const farPlane = 10000;
    const WebGLoutput = containerRef.value

    scene.value = new Scene();
    camera.value = new PerspectiveCamera(felidView, aspect, nearPlane, farPlane);
    camera.value.position.z = cameraZ.value
    renderer.value = new CSS3DRenderer()
    renderer.value.setSize(width, height * 0.9)
    renderer.value.domElement.style.position = 'absolute';
    // 垂直居中
    renderer.value.domElement.style.paddingTop = '50px'
    renderer.value.domElement.style.top = '50%';
    renderer.value.domElement.style.left = '50%';
    renderer.value.domElement.style.transform = 'translate(-50%, -50%)';
    renderer.value.domElement.style.boxSizing = 'border-box';
    WebGLoutput!.appendChild(renderer.value.domElement);

    controls.value = new TrackballControls(camera.value, renderer.value.domElement);
    controls.value.rotateSpeed = 1;
    controls.value.staticMoving = true;
    controls.value.minDistance = 500;
    controls.value.maxDistance = 6000;
    controls.value.addEventListener('change', render);

    const tableLen = tableData.value.length
    for (let i = 0; i < tableLen; i++) {
        let element = document.createElement('div');
        element.className = 'element-card';

        const number = document.createElement('div');
        number.className = 'card-id';
        number.textContent = tableData.value[i].uid;
        element.appendChild(number);

        const symbol = document.createElement('div');
        symbol.className = 'card-name';
        symbol.textContent = tableData.value[i].name;
        element.appendChild(symbol);

        const detail = document.createElement('div');
        detail.className = 'card-detail';
        detail.innerHTML = `${tableData.value[i].department}<br/>${tableData.value[i].identity}`;
        element.appendChild(detail);

        element = useElementStyle(element, tableData.value[i], i, patternList.value, patternColor.value, cardColor.value, cardSize.value, textSize.value)
        const object = new CSS3DObject(element);
        object.position.x = Math.random() * 4000 - 2000;
        object.position.y = Math.random() * 4000 - 2000;
        object.position.z = Math.random() * 4000 - 2000;
        scene.value.add(object);

        objects.value.push(object);
    }

    createTableVertices();
    createSphereVertices();
    createHelixVertices();

    function createTableVertices() {
        const tableLen = tableData.value.length;

        for (let i = 0; i < tableLen; i++) {
            const object = new Object3D();

            object.position.x = tableData.value[i].x * (cardSize.value.width + 40) - rowCount.value * 90;
            object.position.y = -tableData.value[i].y * (cardSize.value.height + 20) + 1000;
            object.position.z = 0;

            targets.table.push(object);
        }
    }

    function createSphereVertices() {
        let i = 0;
        const objLength = objects.value.length;
        const vector = new Vector3();

        for (; i < objLength; ++i) {
            let phi = Math.acos(-1 + (2 * i) / objLength);
            let theta = Math.sqrt(objLength * Math.PI) * phi;
            const object = new Object3D();

            object.position.x = 800 * Math.cos(theta) * Math.sin(phi);
            object.position.y = 800 * Math.sin(theta) * Math.sin(phi);
            object.position.z = -800 * Math.cos(phi);

            // rotation object 

            vector.copy(object.position).multiplyScalar(2);
            object.lookAt(vector);
            targets.sphere.push(object);
        }
    }
    function createHelixVertices() {
        let i = 0;
        const vector = new Vector3();
        const objLength = objects.value.length;
        for (; i < objLength; ++i) {
            let phi = i * 0.213 + Math.PI;

            const object = new Object3D();

            object.position.x = 800 * Math.sin(phi);
            object.position.y = -(i * 8) + 450;
            object.position.z = 800 * Math.cos(phi + Math.PI);

            object.scale.set(1.1, 1.1, 1.1);

            vector.x = object.position.x * 2;
            vector.y = object.position.y;
            vector.z = object.position.z * 2;

            object.lookAt(vector);

            targets.helix.push(object);
        }
    }
    window.addEventListener('resize', onWindowResize, false);
    transform(targets.table, 1000)
    render();
}

const transform = (targets: any[], duration: number) => {
    TWEEN.removeAll();
    if (intervalTimer.value) {
        clearInterval(intervalTimer.value);
        intervalTimer.value = null
        randomBallData('sphere')
    }

    return new Promise((resolve) => {
        const objLength = objects.value.length;
        for (let i = 0; i < objLength; ++i) {
            let object = objects.value[i];
            let target = targets[i];
            new TWEEN.Tween(object.position)
                .to({ x: target.position.x, y: target.position.y, z: target.position.z },
                    Math.random() * duration + duration)
                .easing(TWEEN.Easing.Exponential.InOut)
                .start();


            new TWEEN.Tween(object.rotation)
                .to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration)
                .easing(TWEEN.Easing.Exponential.InOut)
                .start()
                .onComplete(() => {
                    if (luckyCardList.value.length) {
                        luckyCardList.value.forEach((cardIndex: any) => {
                            const item = objects.value[cardIndex]
                            useElementStyle(item.element, {} as any, i, patternList.value, patternColor.value, cardColor.value, cardSize.value, textSize.value, 'sphere')
                        })
                    }
                    luckyTargets.value = [];
                    luckyCardList.value = [];

                    canOperate.value = true
                });
        }

        // 这个补间用来在位置与旋转补间同步执行，通过onUpdate在每次更新数据后渲染scene和camera
        new TWEEN.Tween({})
            .to({}, duration * 2)
            .onUpdate(render)
            .start()
            .onComplete(() => {
                canOperate.value = true
                resolve('')
            });
    })
}
function onWindowResize() {
    camera.value.aspect = window.innerWidth / window.innerHeight
    camera.value.updateProjectionMatrix();

    renderer.value.setSize(window.innerWidth, window.innerHeight);
    render();
}

/**
* [animation update all tween && controls]
*/
function animation() {
    TWEEN.update();
    controls.value.update();
    // 设置自动旋转
    // 设置相机位置
    requestAnimationFrame(animation);
}

// // 旋转的动画
function rollBall(rotateY: number, duration: number) {
    TWEEN.removeAll();

    return new Promise((resolve) => {
        scene.value.rotation.y = 0;
        ballRotationY.value = Math.PI * rotateY * 1000
        const rotateObj = new TWEEN.Tween(scene.value.rotation);
        rotateObj
            .to(
                {
                    // x: Math.PI * rotateX * 1000,
                    x: 0,
                    y: ballRotationY.value,
                    // z: Math.PI * rotateZ * 1000
                    z: 0
                },
                duration * 1000
            )
            .onUpdate(render)
            .start()
            .onStop(() => {
                resolve('')
            })
            .onComplete(() => {
                resolve('')
            })
    })
}
// 将视野转回正面
function resetCamera() {
    new TWEEN.Tween(camera.value.position)
        .to(
            {
                x: 0,
                y: 0,
                z: 3000
            },
            1000
        )
        .onUpdate(render)
        .start()
        .onComplete(() => {
            new TWEEN.Tween(camera.value.rotation)
                .to(
                    {
                        x: 0,
                        y: 0,
                        z: 0
                    },
                    1000
                )
                .onUpdate(render)
                .start()
                .onComplete(() => {
                    canOperate.value = true
                    // camera.value.lookAt(scene.value.position)
                    camera.value.position.y = 0
                    camera.value.position.x = 0
                    camera.value.position.z = 3000
                    camera.value.rotation.x = 0
                    camera.value.rotation.y = 0
                    camera.value.rotation.z = -0
                    controls.value.reset()
                })
        })
}

function render() {
    renderer.value.render(scene.value, camera.value);
}

const enterLottery = async () => {
    if (!canOperate.value) {
        return
    }
    if (!intervalTimer.value) {
        randomBallData()
    }
    if (patternList.value.length) {
        for (let i = 0; i < patternList.value.length; i++) {
            if (i < rowCount.value * 7) {
                objects.value[patternList.value[i] - 1].element.style.backgroundColor = rgba(cardColor.value, Math.random() * 0.5 + 0.25)
            }
        }
    }
    canOperate.value = false
    await transform(targets.sphere, 1000)
    currentStatus.value = 1
    rollBall(0.1, 2000)
}
// 开始抽奖
const startLottery = () => {
    if (!canOperate.value) {
        return
    }
    // 验证是否已抽完全部奖项
    if (currentPrize.value.isUsed || !currentPrize.value) {
        toast.open({
            message: '抽奖抽完了',
            type: 'warning',
            position: 'top-right',
            duration: 10000
        })

        return

    }
    personPool.value = currentPrize.value.isAll ? notThisPrizePersonList.value : notPersonList.value

    if (currentPrize.value.isExclude) {
        personPool.value = personPool.value.filter((item: IPersonConfig) => {
            const uidStr = String(item.uid)
            return !excludedUserIds.includes(uidStr) && !noLuckyPersonList.includes(uidStr);
        })
    }

    console.log('personPool', personPool.value)
    // console.log('currentPrize', currentPrize.value)
    // 验证抽奖人数是否还够
    if (personPool.value.length < currentPrize.value.count - currentPrize.value.isUsedCount) {
        toast.open({
            message: '抽奖人数不够',
            type: 'warning',
            position: 'top-right',
            duration: 10000
        })

        return;
    }
    luckyCount.value = 20
    // 自定义抽奖个数

    let leftover = currentPrize.value.count - currentPrize.value.isUsedCount
    const customCount = currentPrize.value.separateCount
    if (customCount && customCount.enable && customCount.countList.length > 0) {
        for (let i = 0; i < customCount.countList.length; i++) {
            if (customCount.countList[i].isUsedCount < customCount.countList[i].count) {
                leftover = customCount.countList[i].count - customCount.countList[i].isUsedCount
                break;
            }
        }
    }
    // leftover < luckyCount.value ? luckyCount.value = leftover : luckyCount

    // 最多抽20或剩余名额
    luckyCount.value = Math.min(20, leftover);
    const HIGH_PRIORITY_UIDS = ['61', '62', '63', '38', '27'];
    const priorityPersons: IPersonConfig[] = [];
    const normalPersons: IPersonConfig[] = [];

    const WEIGHT_HIGH = 2;
    const WEIGHT_NORMAL = 1;

    // 构建带权重的池子
    const weightedPool: { person: IPersonConfig; weight: number }[] = personPool.value.map(person => {
        const isHighPriority = HIGH_PRIORITY_UIDS.includes(String(person.uid));
        return {
            person,
            weight: isHighPriority ? WEIGHT_HIGH : WEIGHT_NORMAL
        };
    });

    // 加权随机抽样函数（无放回）
    function weightedRandomSample(pool: typeof weightedPool, count: number): IPersonConfig[] {
        if (count >= pool.length) {
            return pool.map(item => item.person);
        }

        const result: IPersonConfig[] = [];
        let remainingPool = [...pool];

        for (let i = 0; i < count; i++) {
            if (remainingPool.length === 0) break;

            // 计算总权重
            const totalWeight = remainingPool.reduce((sum, item) => sum + item.weight, 0);
            let random = Math.random() * totalWeight;

            // 找到命中项
            for (let j = 0; j < remainingPool.length; j++) {
                random -= remainingPool[j].weight;
                if (random <= 0) {
                    const selected = remainingPool.splice(j, 1)[0];
                    result.push(selected.person);
                    break;
                }
            }
        }

        return result;
    }

    // 执行加权抽样
    luckyTargets.value = weightedRandomSample(weightedPool, luckyCount.value);

    // 可选：打乱顺序
    for (let i = luckyTargets.value.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [luckyTargets.value[i], luckyTargets.value[j]] = [luckyTargets.value[j], luckyTargets.value[i]];
    }

    // for (let i = 0; i < luckyCount.value; i++) {
    //     if (personPool.value.length > 0) {
    //         const randomIndex = Math.floor(Math.random() * personPool.value.length);
    //         luckyTargets.value.push(personPool.value[randomIndex])
    //         personPool.value.splice(randomIndex, 1)
    //     }
    // }
    toast.open({
        message: `现在抽取${currentPrize.value.name} ${leftover}人`,
        type: 'default',
        position: 'top-right',
        duration: 8000
    })
    currentStatus.value = 2
    rollBall(10, 3000)
}

// 停止抽奖 - 中奖卡片同时出现在指定位置 - 同时揭晓
// const stopLottery = async () => {
//     if (!canOperate.value) {
//         return
//     }
//     clearInterval(intervalTimer.value)
//     intervalTimer.value = null
//     canOperate.value = false
//     rollBall(0, 1)

//     const windowSize = { width: window.innerWidth, height: window.innerHeight }

//     let currentSize = luckyCount.value > 10 ? 1.5 : 2
//     // console.log(111, luckyCount.value,currentSize,cardSize.value,windowSize)
//     luckyTargets.value.forEach((person: IPersonConfig, index: number) => {
//         let cardIndex = selectCard(luckyCardList.value, tableData.value.length, person.id)
//         luckyCardList.value.push(cardIndex)
//         let item = objects.value[cardIndex]

//         // console.log(222+'抽奖', item)
//         const { xTable, yTable } = useElementPosition(item, rowCount.value, { width: cardSize.value.width * currentSize, height: cardSize.value.height * currentSize }, windowSize, index, currentSize)
//         // console.log(333, xTable, yTable)
//         new TWEEN.Tween(item.position)
//             .to({
//                 x: xTable,
//                 y: yTable,
//                 z: 1000
//             }, 1200)
//             .easing(TWEEN.Easing.Exponential.InOut)
//             .onStart(() => {
//                 item.element = useElementStyle(item.element, person, cardIndex, patternList.value, patternColor.value, luckyColor.value, { width: cardSize.value.width * currentSize, height: cardSize.value.height * currentSize }, textSize.value * currentSize, 'lucky')
//             })
//             .start()
//             .onComplete(() => {
//                 canOperate.value = true
//                 currentStatus.value = 3
//             })
//         new TWEEN.Tween(item.rotation)
//             .to({
//                 x: 0,
//                 y: 0,
//                 z: 0
//             }, 900)
//             .easing(TWEEN.Easing.Exponential.InOut)
//             .start()
//             .onComplete(() => {
//                 confettiFire()
//                 resetCamera()
//             })
//     })
//     // console.log('luckyCardList', luckyCardList.value)
// }


// 中奖卡片按顺序飞向指定位置，逐个揭晓
const stopLottery = async () => {
    if (!canOperate.value) {
        return
    }
    clearInterval(intervalTimer.value)
    intervalTimer.value = null
    canOperate.value = false

    // 先等待球体停止旋转
    await rollBall(0, 1)

    const windowSize = { width: window.innerWidth, height: window.innerHeight }

    let currentSize = luckyCount.value < 5 ? 2 : 1.5
    let finishCount = 0
    const total = luckyTargets.value.length

    // 计算最长的动画时间（最后一张卡片的延迟 + 动画时长）
    const intervalMs = luckyCount.value < 10 ? 2000 : 1000
    const maxDelayMs = (total - 1) * intervalMs
    const animationDuration = maxDelayMs + 1200

    // 创建一个空的 TWEEN 用于持续触发渲染
    new TWEEN.Tween({})
        .to({}, animationDuration)
        .onUpdate(render)
        .start()

    // 使用 forEach + TWEEN.delay() 实现依次显示效果
    luckyTargets.value.forEach((person: IPersonConfig, index: number) => {
        const cardIndex = selectCard(luckyCardList.value, tableData.value.length, person.id)
        luckyCardList.value.push(cardIndex)
        const item = objects.value[cardIndex]

        const { xTable, yTable } = useElementPosition(
            item,
            rowCount.value,
            { width: cardSize.value.width * currentSize, height: cardSize.value.height * currentSize },
            windowSize,
            index,
            currentSize
        )

        const delayMs = index * intervalMs // 每张卡片错开 400ms

        new TWEEN.Tween(item.position)
            .to({ x: xTable, y: yTable, z: 1000 }, 1200)
            .delay(delayMs)
            .easing(TWEEN.Easing.Exponential.InOut)
            .onStart(() => {
                item.element = useElementStyle(
                    item.element,
                    person,
                    cardIndex,
                    patternList.value,
                    patternColor.value,
                    luckyColor.value,
                    { width: cardSize.value.width * currentSize, height: cardSize.value.height * currentSize },
                    textSize.value * currentSize,
                    'lucky'
                )
            })
            .onComplete(() => {
                finishCount++
                if (finishCount === total) {
                    // 所有卡片完成后再做结尾动作
                    canOperate.value = true
                    currentStatus.value = 3
                    confettiFire()
                    resetCamera()
                }
            })
            .start()

        new TWEEN.Tween(item.rotation)
            .to({ x: 0, y: 0, z: 0 }, 900)
            .delay(delayMs)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start()
    })
}

const continueLottery = async () => {
    if (!canOperate.value) {
        return
    }

    const customCount = currentPrize.value.separateCount
    if (customCount && customCount.enable && customCount.countList.length > 0) {
        for (let i = 0; i < customCount.countList.length; i++) {
            if (customCount.countList[i].isUsedCount < customCount.countList[i].count) {
                customCount.countList[i].isUsedCount += luckyCount.value
                break;
            }
        }
    }
    currentPrize.value.isUsedCount += luckyCount.value
    luckyCount.value = 0
    if (currentPrize.value.isUsedCount >= currentPrize.value.count) {
        currentPrize.value.isUsed = true
        currentPrize.value.isUsedCount = currentPrize.value.count
    }
    personConfig.addAlreadyPersonList(luckyTargets.value, currentPrize.value)
    prizeConfig.updatePrizeConfig(currentPrize.value)
    await enterLottery()
}
const quitLottery = () => {
    enterLottery()
    currentStatus.value = 0
}
// 庆祝动画
const confettiFire = () => {
    const duration = 3 * 1000;
    const end = Date.now() + duration;
    (function frame() {
        // launch a few confetti from the left edge
        confetti({
            particleCount: 2,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
        });
        // and launch a few from the right edge
        confetti({
            particleCount: 2,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
        });

        // keep going until we are out of time
        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
    centerFire(0.25, {
        spread: 26,
        startVelocity: 55,
    });
    centerFire(0.2, {
        spread: 60,
    });
    centerFire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8
    });
    centerFire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2
    });
    centerFire(0.1, {
        spread: 120,
        startVelocity: 45,
    });
}
const centerFire = (particleRatio: number, opts: any) => {
    const count = 200
    confetti({
        origin: { y: 0.7 },
        ...opts,
        particleCount: Math.floor(count * particleRatio)
    });
}

const setDefaultPersonList = () => {
    personConfig.setDefaultPersonList()
    // 刷新页面
    window.location.reload()
}
// 随机替换数据
const randomBallData = (mod: 'default' | 'lucky' | 'sphere' = 'default') => {
    // 两秒执行一次
    intervalTimer.value = setInterval(() => {
        // 产生随机数数组
        const indexLength = 4
        const cardRandomIndexArr: number[] = []
        const personRandomIndexArr: number[] = []
        for (let i = 0; i < indexLength; i++) {
            cardRandomIndexArr.push(Math.round(Math.random() * (tableData.value.length - 1)))
            personRandomIndexArr.push(Math.round(Math.random() * (allPersonList.value.length - 1)))
        }
        for (let i = 0; i < cardRandomIndexArr.length; i++) {
            if (!objects.value[cardRandomIndexArr[i]]) {
                continue;
            }
            objects.value[cardRandomIndexArr[i]].element = useElementStyle(objects.value[cardRandomIndexArr[i]].element, allPersonList.value[personRandomIndexArr[i]], cardRandomIndexArr[i], patternList.value, patternColor.value, cardColor.value, { width: cardSize.value.width, height: cardSize.value.height }, textSize.value, mod)
        }
    }, 200)
}
// 监听键盘
const listenKeyboard = () => {
    window.addEventListener('keydown', (e: any) => {
        if ((e.keyCode !== 32 || e.keyCode !== 27) && !canOperate.value) {
            return
        }
        if (e.keyCode === 27 && currentStatus.value === 3) {
            quitLottery()
        }
        if (e.keyCode !== 32) {
            return
        }
        switch (currentStatus.value) {
            case 0:
                enterLottery()
                break;
            case 1:
                startLottery()
                break;
            case 2:
                stopLottery()
                break;
            case 3:
                continueLottery()
                break;
            default:
                break;
        }
    })
}
onMounted(() => {
    initTableData();
    init();
    animation();
    containerRef.value!.style.color = `${textColor}`
    randomBallData()
    listenKeyboard()
});
onUnmounted(() => {
    clearInterval(intervalTimer.value)
    intervalTimer.value = null
    window.removeEventListener('keydown', listenKeyboard)
})
// watch(() => currentPrize.value.isUsed, (val) => {
//     if (val) {
//         currentPrize.value = JSON.parse(JSON.stringify(currentPrize.value))
//     }
// })
</script>

<template>
    <div class="absolute z-10 flex flex-col items-center justify-center -translate-x-1/2 left-1/2">
        <!-- <h2 class="pt-12 m-0 mb-12 font-mono tracking-wide text-center leading-12 header-title"
            :style="{ fontSize: textSize * 1.5 + 'px', color: textColor }">{{ topTitle }}</h2> -->
        <img src="@/assets/logo.png" alt="" style="height: 120px;padding-top: 24px;">
        <div class="flex gap-3">
            <button v-if="tableData.length <= 0" class="cursor-pointer btn btn-outline btn-secondary btn-lg"
                @click="router.push('config')">暂无人员信息，前往导入</button>
            <button v-if="tableData.length <= 0" class="cursor-pointer btn btn-outline btn-secondary btn-lg"
                @click="setDefaultPersonList">使用默认数据</button>
        </div>
    </div>
    <div id="container" ref="containerRef" class="3dContainer">

        <!-- ��中菜单结构 start-->
        <div id="menu">
            <button class="btn-end " @click="enterLottery"
                v-if="currentStatus == 0 && tableData.length > 0">进入抽奖</button>


            <!--   <button id="table" @click="transform(targets.table, 2000)">TABLE</button> -->
            <!--  <button id="helix" @click="transform(targets.helix, 2000)">HELIX</button> -->

        </div>
        <div id="lottery-btns">
            <div class="start" v-if="currentStatus != 0">
                <div class="new_lottery-card" v-if="currentStatus == 1">
                    <img src="@/assets/03_.gif" alt="" class="prize-img">
                    <div class="new_btn-start" @click="startLottery" >
                        <span>开始</span>
                    </div>
                </div>
                <div class="new_lottery-card" v-if="currentStatus == 2">
                    <img src="@/assets/09.gif" alt="" class="prize-img">
                    
                    <div class="new_btn-start" @click="stopLottery">
                        <span>抽取幸运儿</span>
                    </div>
                     
                </div>
                <div class="new_lottery-card" v-if="currentStatus == 3">
                    <img src="@/assets/13.gif" alt="" class="prize-img">
                    
                    <div class="new_btn-start" @click="continueLottery">
                        <span>继续！</span>
                     </div>
                     
                </div>

            </div>



            <!-- <div v-if="currentStatus == 3" class="flex justify-center gap-6 enStop">
                <div class="start">
                    <div class="new_btn-continue" @click="continueLottery"><strong>继续！</strong>

                    </div>

                </div>
                <div class="start">
                    <button class="btn-cancel" @click="quitLottery" v-show="false"><strong>取消</strong>
                        <div id="container-stars">
                            <div id="stars"></div>
                        </div>

                        <div id="glow">
                            <div class="circle"></div>
                            <div class="circle"></div>
                        </div>
                    </button>
                </div>
            </div> -->
        </div>
        <!-- end -->
    </div>
    <StarsBackground></StarsBackground>

    <!-- <LuckyView :luckyPersonList="luckyTargets"  ref="LuckyViewRef"></LuckyView> -->
    <!-- <PlayMusic class="absolute right-0 bottom-1/2"></PlayMusic> -->
    <PrizeList class="absolute left-0 top-2/4 -translate-y-2/4"></PrizeList>

    <!-- <transition name="current-prize" :appear="true">
            <div class="current-prize_container" v-if="currentStatus != 0">
                <div class="current-prize_box">
                    <div class="current-prize_bottom"></div>
                </div>
                <div class="current-prize_img w-72 h-72 flex items-center justify-center">
                    <img :src="currentPrize.picture.url" alt="" class="w-3/4">
                </div>
            </div>
    </transition> -->
</template>

<style scoped lang="scss">
#menu {
    position: absolute;
    z-index: 100;
    width: 100%;
    bottom: 50px;
    text-align: center;
    margin: 0 auto;
    font-size: 32px;
}

.header-title {
    -webkit-animation: tracking-in-expand-fwd 0.8s cubic-bezier(0.215, 0.610, 0.355, 1.000) both;
    animation: tracking-in-expand-fwd 0.8s cubic-bezier(0.215, 0.610, 0.355, 1.000) both;
}

.start {
    // 居中
    display: flex;
    justify-content: center;
}

.btn-start {
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 13rem;
    overflow: hidden;
    height: 3rem;
    background-size: 300% 300%;
    backdrop-filter: blur(1rem);
    border-radius: 5rem;
    transition: 0.5s;
    animation: gradient_301 5s ease infinite;
    border: double 4px transparent;
    background-image: linear-gradient(#212121, #212121), linear-gradient(137.48deg, #ffdb3b 10%, #FE53BB 45%, #8F51EA 67%, #0044ff 87%);
    background-origin: border-box;
    background-clip: content-box, border-box;
    -webkit-animation: pulsate-fwd 1.2s ease-in-out infinite both;
    animation: pulsate-fwd 1.2s ease-in-out infinite both;
}

.btn-cancel {
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 13rem;
    overflow: hidden;
    height: 3rem;
    background-size: 300% 300%;
    backdrop-filter: blur(1rem);
    border-radius: 5rem;
    transition: 0.5s;
    animation: gradient_301 5s ease infinite;
    border: double 4px transparent;
    background-image: linear-gradient(#212121, #212121), linear-gradient(137.48deg, #ffdb3b 10%, #FE53BB 45%, #8F51EA 67%, #0044ff 87%);
    background-origin: border-box;
    background-clip: content-box, border-box;
}

#container-stars {
    position: absolute;
    z-index: -1;
    width: 100%;
    height: 100%;
    overflow: hidden;
    transition: 0.5s;
    backdrop-filter: blur(1rem);
    border-radius: 5rem;
}

strong {
    z-index: 2;
    font-family: 'Avalors Personal Use';
    font-size: 12px;
    letter-spacing: 5px;
    color: #FFFFFF;
    text-shadow: 0 0 4px white;
}

#glow {
    position: absolute;
    display: flex;
    width: 12rem;
}

.circle {
    width: 100%;
    height: 30px;
    filter: blur(2rem);
    animation: pulse_3011 4s infinite;
    z-index: -1;
}

.circle:nth-of-type(1) {
    background: rgba(254, 83, 186, 0.636);
}

.circle:nth-of-type(2) {
    background: rgba(142, 81, 234, 0.704);
}

.btn-start:hover #container-stars {
    z-index: 1;
    background-color: #212121;
}

.btn-start:hover {
    transform: scale(1.1)
}

.btn-start:active {
    border: double 4px #FE53BB;
    background-origin: border-box;
    background-clip: content-box, border-box;
    animation: none;
}

.btn-start:active .circle {
    background: #FE53BB;
}

#stars {
    position: relative;
    background: transparent;
    width: 200rem;
    height: 200rem;
}

#stars::after {
    content: "";
    position: absolute;
    top: -10rem;
    left: -100rem;
    width: 100%;
    height: 100%;
    animation: animStarRotate 90s linear infinite;
}

#stars::after {
    background-image: radial-gradient(#ffffff 1px, transparent 1%);
    background-size: 50px 50px;
}

#stars::before {
    content: "";
    position: absolute;
    top: 0;
    left: -50%;
    width: 170%;
    height: 500%;
    animation: animStar 60s linear infinite;
}

#stars::before {
    background-image: radial-gradient(#ffffff 1px, transparent 1%);
    background-size: 50px 50px;
    opacity: 0.5;
}

.current-prize-enter-active {
    // 延时显示
    animation: show-operate 0.6s;
    -webkit-animation: show-operate 0.6s;
}

.current-prize_container {
    position: fixed;
    right: 10rem;
    top: 35%;
    transform: translateY(-50%);
}

.current-prize_box {
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translateZ(-150px) rotateX(72deg);
    transform-style: preserve-3d;

}

// .current-prize_bottom {
//     width: 240px;
//     height: 240px;
//     transform-style: preserve-3d;
//     position: relative;
//     border-radius: 50%;
//     border: 5px solid #EDC952;
//     border-left-color: transparent;
//     border-right-color: transparent;
//     outline: 2px solid #EDC952;
//     outline-offset: 10px;
//     background: repeating-radial-gradient(#F48E00,
//             #F48E00 50%,
//             transparent 50%,
//             transparent 60%,
//             #F48E00 60%,
//             #F48E00 100%),
//         repeating-conic-gradient(#EDC952 0,
//         #EDC952 4%,
//             transparent 4%,
//             transparent 5%);
//     animation: rotate2 2s linear infinite;
// }

.current-prize_img {
    border-radius: 50%;
    // border:1px solid #EDC952;
}


@-webkit-keyframes show-operate {
    0% {
        opacity: 0;
    }

    99% {
        opacity: 0.5;
    }

    100% {
        opacity: 1;
    }
}

@keyframes show-operate {
    0% {
        opacity: 0;
    }

    99% {
        opacity: 0.5;
    }

    100% {
        opacity: 1;
    }
}

@keyframes animStar {
    from {
        transform: translateY(0);
    }

    to {
        transform: translateY(-135rem);
    }
}

@keyframes animStarRotate {
    from {
        transform: rotate(360deg);
    }

    to {
        transform: rotate(0);
    }
}

@keyframes gradient_301 {
    0% {
        background-position: 0% 50%;
    }

    50% {
        background-position: 100% 50%;
    }

    100% {
        background-position: 0% 50%;
    }
}

@keyframes pulse_3011 {
    0% {
        transform: scale(0.75);
        box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.7);
    }

    70% {
        transform: scale(1);
        box-shadow: 0 0 0 10px rgba(0, 0, 0, 0);
    }

    100% {
        transform: scale(0.75);
        box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
    }
}

@keyframes line {
    0% {
        transform: translateZ(-50px) rotateX(90deg) rotateY(0deg);
    }

    100% {
        transform: translateZ(200px) rotateX(90deg) rotateY(-360deg);
    }
}

@keyframes rotate1 {
    0% {
        transform: translateZ(200px) rotateZ(0deg);
    }

    100% {
        transform: translateZ(200px) rotateZ(-720deg);
    }
}

@keyframes rotate2 {
    0% {
        transform: rotateZ(0deg);
    }

    100% {
        transform: rotateZ(360deg);
    }
}

.btn-end {
    -webkit-animation: pulsate-fwd 0.9s ease-in-out infinite both;
    animation: pulsate-fwd 0.9s ease-in-out infinite both;
    cursor: pointer;
}

.btn-end {
    --glow-color: #F48E00;
    --glow-spread-color: #F48E00;
    --enhanced-glow-color: #F48E00;
    --btn-color: transparent;
    border: .25em solid var(--glow-color);
    padding: 1em 3em;
    color: var(--glow-color);
    font-size: 15px;
    font-weight: bold;
    background-color: var(--btn-color);
    border-radius: 1em;
    outline: none;
    box-shadow: 0 0 1em .25em var(--glow-color),
        0 0 4em 1em var(--glow-spread-color),
        inset 0 0 .75em .25em var(--glow-color);
    text-shadow: 0 0 .5em var(--glow-color);
    position: relative;
    transition: all 0.3s;
    -webkit-animation: swing-in-top-fwd 0.5s cubic-bezier(0.175, 0.885, 0.320, 1.275) both;
    animation: swing-in-top-fwd 0.5s cubic-bezier(0.175, 0.885, 0.320, 1.275) both;
}

// .btn-end::after {
//     pointer-events: none;
//     content: "";
//     position: absolute;
//     top: 120%;
//     left: 0;
//     height: 100%;
//     width: 100%;
//     background-color: var(--glow-spread-color);
//     filter: blur(2em);
//     opacity: .7;
//     transform: perspective(1.5em) rotateX(35deg) scale(1, .6);
// }

// .btn-end:hover {
//     color: var(--btn-color);
//     background-color: var(--glow-color);
//     box-shadow: 0 0 1em .25em var(--glow-color),
//         0 0 4em 2em var(--glow-spread-color),
//         inset 0 0 .75em .25em var(--glow-color);
// }

// .btn-end:active {
//     box-shadow: 0 0 0.6em .25em var(--glow-color),
//         0 0 2.5em 2em var(--glow-spread-color),
//         inset 0 0 .5em .25em var(--glow-color);
// }

#lottery-btns {
    position: absolute;
    right: 5rem;
    top: 50%;
    transform: translateY(-50%);
    z-index: 999;

    .new_lottery-card {
        padding: 2rem;
        border-radius: 16px;
        background: linear-gradient(0deg, #E04243 0%, #DA2421 100%);
        display: flex;
        align-items: center;
        flex-direction: column;
        gap: 2rem;
        .prize-img {
            width: 8.5rem;
            height: 8.5rem;
            object-fit: cover;
            border-radius: 8px;
        }
    }
    .new_btn-start {
        cursor: pointer;
        width: 10rem;
        height: 2.5rem;
        line-height: 2.5rem;
        border-radius: 2.5rem;
        background-color: #FFC73A;
        position: relative;
        text-align: center;
        font-weight: bold;
        font-size: 1.2rem;
        color: #000000;
    }
   
}

// 按钮动画
@-webkit-keyframes pulsate-fwd {
    0% {
        -webkit-transform: scale(1);
        transform: scale(1);
    }

    50% {
        -webkit-transform: scale(1.1);
        transform: scale(1.1);
    }

    100% {
        -webkit-transform: scale(1);
        transform: scale(1);
    }
}

@keyframes pulsate-fwd {
    0% {
        -webkit-transform: scale(1);
        transform: scale(1);
    }

    50% {
        -webkit-transform: scale(1.2);
        transform: scale(1.2);
    }

    100% {
        -webkit-transform: scale(1);
        transform: scale(1);
    }
}

@-webkit-keyframes tracking-in-expand-fwd {
    0% {
        letter-spacing: -0.5em;
        -webkit-transform: translateZ(-700px);
        transform: translateZ(-700px);
        opacity: 0;
    }

    40% {
        opacity: 0.6;
    }

    100% {
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
        opacity: 1;
    }
}

@keyframes tracking-in-expand-fwd {
    0% {
        letter-spacing: -0.5em;
        -webkit-transform: translateZ(-700px);
        transform: translateZ(-700px);
        opacity: 0;
    }

    40% {
        opacity: 0.6;
    }

    100% {
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
        opacity: 1;
    }
}

/* 完整的 swing-in-top-fwd 关键帧定义（必配） */
@-webkit-keyframes swing-in-top-fwd {
    0% {
        -webkit-transform: rotateX(-100deg);
        /* 初始：沿X轴向上旋转100°（完全在顶部视野外） */
        transform: rotateX(-100deg);
        -webkit-transform-origin: top;
        /* 旋转原点：元素顶部（保证从顶部摆动） */
        transform-origin: top;
        opacity: 0;
        /* 初始透明，无存在感 */
    }

    100% {
        -webkit-transform: rotateX(0deg);
        /* 结束：恢复水平，无旋转 */
        transform: rotateX(0deg);
        -webkit-transform-origin: top;
        transform-origin: top;
        opacity: 1;
        /* 完全不透明，显示元素 */
    }
}

@keyframes swing-in-top-fwd {
    0% {
        transform: rotateX(-100deg);
        transform-origin: top;
        opacity: 0;
    }

    100% {
        transform: rotateX(0deg);
        transform-origin: top;
        opacity: 1;
    }
}
</style>
