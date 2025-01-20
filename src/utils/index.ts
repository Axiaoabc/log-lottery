import dayjs from 'dayjs';
// 筛选人员数据
export const filterData = (tableData: any[], localRowCount: number, startIndex = 0) => {
    const dataLength = tableData.length
    let j = 0;
    for (let i = 0; i < dataLength; i++) {
        if (i % localRowCount === 0) {
            j++;
        }
        tableData[i].x = i % localRowCount + 1;
        tableData[i].y = j;
        tableData[i].id = i;
        // 是否中奖
    }

    return tableData
}

export const addOtherInfo = (personList: any[]) => {
    const len = personList.length;
    for (let i = 0; i < len; i++) {
        personList[i].id = i
        personList[i].createTime = dayjs(new Date()).format('YYYY-MM-DD HH:mm:ss');
        personList[i].updateTime = dayjs(new Date()).format('YYYY-MM-DD HH:mm:ss');
        personList[i].prizeName = [] as string[];
        personList[i].prizeTime = [] as string[];
        personList[i].prizeId = [];
        personList[i].isWin = false
    }

    return personList
}

export const selectCard = (cardIndexArr: number[], tableLength: number, personId: number): number => {
    const cardIndex = Math.round(Math.random() * (tableLength - 1));
    if (cardIndexArr.includes(cardIndex)) {
        return selectCard(cardIndexArr, tableLength, personId)
    }

    return cardIndex
}

interface SplitArrayResult<T> {
    matchedlen: T[];
    unmatchedlen: T[];
}

/**
 * 将数组按照指定条件分割成两个数组
 * @param array 要分割的原始数组
 * @param requiredToSplit 必须包含的元素ID数组
 * @param partOneLength 第一个数组的目标长度
 * @returns 返回分割后的两个数组
 */
function splitArraysByOrdinarys<T extends { uid: string }>(
    array: T[],
    requiredToSplit: string[],
    partOneLength: number
): SplitArrayResult<T> {
    // 创建数组副本并随机打乱
    let shuffledArray = [...array].sort(() => Math.random() - 0.5);
    shuffledArray = shuffledArray.sort(() => Math.random() - 0.5);
console.log('splitArraysByOrdinarys',requiredToSplit)
    // 找出必须包含的元素的索引
    const sortedIndices = requiredToSplit
        .map(id => shuffledArray.findIndex(item => item.uid == id))
        .filter(index => index != -1)
        .sort((a, b) => a - b);

    // 初始化结果数组
    const matchedlen: T[] = [];
    const unmatchedlen: T[] = [];

    // 确保matchedlen中包含所有requiredToSplit中的元素
    for (const index of sortedIndices) {
        if (matchedlen.length < partOneLength) {
            matchedlen.push(shuffledArray[index]);
        } else {
            unmatchedlen.push(shuffledArray[index]);
        }
    }

    // 分配剩余元素到matchedlen（如果还有位置）
    for (let i = 0; i < shuffledArray.length && matchedlen.length < partOneLength; i++) {
        if (!sortedIndices.includes(i)) {
            matchedlen.push(shuffledArray[i]);
        }
    }

    // 将剩余未分配的元素添加到unmatchedlen
    for (const item of shuffledArray) {
        if (!matchedlen.includes(item) && !unmatchedlen.includes(item)) {
            unmatchedlen.push(item);
        }
    }

    return { matchedlen, unmatchedlen };
}

export { splitArraysByOrdinarys };
