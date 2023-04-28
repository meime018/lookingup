import * as fs from "fs";
import * as path from "path";
//------------------------
type Row = {
    sample:number;
    high:number;
    low:number;
    tooHigh:number;
    tooLow:number;
}//行の要素をTypeで定義する
function fileSplit(readF:String):{rows:Row[],maxNumber:number}{//入力は読んだreadF,出力は行の要素を保存した行列と最大値
    const rows: Row[] = [];//各行の要素を保存するため行列
    const lines = readF.split("\n");//行を分離
    let maxNumber = 0;//全ての要素の最大値を保存するため

    for (const line of lines){
        const [sample, high, low, tooHigh, tooLow] = line.split(",").map(Number);
        const maxRowNumber = Math.max(sample, high, low, tooHigh, tooLow)
        if (maxNumber < maxRowNumber){
            maxNumber = maxRowNumber;//最大値を保存する
        }
        if (sample > 0){//0番目はsample,高い,安い,高すぎる,安すぎるなので、保存する必要がない
            rows.push({sample, high, low, tooHigh, tooLow});//各行の要素を行列に保存する
        }
    }
    return {rows, maxNumber};
}
//ここまでは入力データを行ごとで分離する関数
//------------------------
type Count = {
    highCount:number;
    lowCount:number;
    tooHighCount:number;
    tooLowCount:number;
}//計算結果の保存
function numberCount(rows: Row[],maxNumber:number,Batch:number):Count[]{//入力は行ごとで分離して保存する行列、と回答単位（今回は50円）
    const section = Math.ceil(maxNumber/Batch);//numの数
    const rowLength = rows.length;//回答人数
    let num: Count[] = [];

    for (let i = 0; i < section; i++) {//初期化
        num.push({
          highCount: 0,
          lowCount: 0,
          tooHighCount: 0,
          tooLowCount: 0,
        });
    }
    for (let i = 0; i < rowLength; i++){//各区間の人の数
        let na = Math.ceil(rows[i].high/Batch)-1;//50*i<na<=50*(i+1)
        let nb = Math.floor(rows[i].low/Batch);//50*i<=na<50*(i+1)
        let nc = Math.ceil(rows[i].tooHigh/Batch)-1;//50*i<na<=50*(i+1)
        let nd = Math.floor(rows[i].tooLow/Batch);//50*i<=na<50*(i+1)
        num[na].highCount += 1;
        num[nb].lowCount += 1;
        num[nc].tooHighCount += 1;
        num[nd].tooLowCount += 1;
    }
    for (let i = 1; i < section; i++){//50*iより小さいと思う人の人数
        num[i].highCount += num[i-1].highCount;
        num[i].lowCount += num[i-1].lowCount;
        num[i].tooHighCount += num[i-1].tooHighCount;
        num[i].tooLowCount += num[i-1].tooLowCount;
    }
    for (let i = 0; i < section; i++){//安いと思う人のデータは全人数から減る必要がある
        num[i].lowCount = rowLength - num[i].lowCount;
        num[i].tooLowCount = rowLength - num[i].tooLowCount;
    }
    for (let i = 0; i < section; i++){//人数をパーセント化にする（小数点1桁保存）
        num[i].highCount = Number((num[i].highCount/rowLength*100).toFixed(1));
        num[i].lowCount = Number((num[i].lowCount/rowLength*100).toFixed(1));
        num[i].tooHighCount = Number((num[i].tooHighCount/rowLength*100).toFixed(1));
        num[i].tooLowCount = Number((num[i].tooLowCount/rowLength*100).toFixed(1));
    }
    return num;
}
//ここまでは回答者のパーセントを求める関数
//------------------------
function calculatePSM(num:Count[],Batch:number):{UpperPrice:number, LowerPrice:number,OptimumPrice:number,IndifferencePrice:number}{
    let UpperPrice:number=0;//最高価格
    let LowerPrice:number=0;//最低品質価格
    let OptimumPrice:number=0;//理想価格
    let IndifferencePrice:number=0;//妥協価格

    for(let i = 0; i < num.length-1;i++){
        if ((num[i].tooHighCount-num[i].lowCount)*(num[i+1].tooHighCount-num[i+1].lowCount)<=0){//2つの線分に交点があるかどうかを判断する
            
            let [x1,x2,x3,x4] = [Batch*(i+1),Batch*(i+2),Batch*(i+1),Batch*(i+2)]
            let [y1,y2,y3,y4] = [num[i].tooHighCount,num[i+1].tooHighCount,num[i].lowCount,num[i+1].lowCount]
            UpperPrice = ((y3-y1)*(x1-x2)*(x3-x4)+x1*(y1-y2)*(x3-x4)-x3*(y3-y4)*(x1-x2))/((y1-y2)*(x3-x4)-(x1-x2)*(y3-y4))//Page VI-56 で書いた２直線の交点の求め公式
        }
        if ((num[i].highCount-num[i].tooLowCount)*(num[i+1].highCount-num[i+1].tooLowCount)<=0){//2つの線分に交点があるかどうかを判断する
            let [x1,x2,x3,x4] = [Batch*(i+1),Batch*(i+2),Batch*(i+1),Batch*(i+2)]
            let [y1,y2,y3,y4] = [num[i].highCount,num[i+1].highCount,num[i].tooLowCount,num[i+1].tooLowCount]
            LowerPrice = ((y3-y1)*(x1-x2)*(x3-x4)+x1*(y1-y2)*(x3-x4)-x3*(y3-y4)*(x1-x2))/((y1-y2)*(x3-x4)-(x1-x2)*(y3-y4))//Page VI-56 で書いた２直線の交点の求め公式
        }
        if ((num[i].tooHighCount-num[i].tooLowCount)*(num[i+1].tooHighCount-num[i+1].tooLowCount)<=0){//2つの線分に交点があるかどうかを判断する
            let [x1,x2,x3,x4] = [Batch*(i+1),Batch*(i+2),Batch*(i+1),Batch*(i+2)]
            let [y1,y2,y3,y4] = [num[i].tooHighCount,num[i+1].tooHighCount,num[i].tooLowCount,num[i+1].tooLowCount]
            OptimumPrice = ((y3-y1)*(x1-x2)*(x3-x4)+x1*(y1-y2)*(x3-x4)-x3*(y3-y4)*(x1-x2))/((y1-y2)*(x3-x4)-(x1-x2)*(y3-y4))//Page VI-56 で書いた２直線の交点の求め公式
        }
        if ((num[i].highCount-num[i].lowCount)*(num[i+1].highCount-num[i+1].lowCount)<=0){//2つの線分に交点があるかどうかを判断する
            let [x1,x2,x3,x4] = [Batch*(i+1),Batch*(i+2),Batch*(i+1),Batch*(i+2)]
            let [y1,y2,y3,y4] = [num[i].highCount,num[i+1].highCount,num[i].lowCount,num[i+1].lowCount]
            IndifferencePrice = ((y3-y1)*(x1-x2)*(x3-x4)+x1*(y1-y2)*(x3-x4)-x3*(y3-y4)*(x1-x2))/((y1-y2)*(x3-x4)-(x1-x2)*(y3-y4))//Page VI-56 で書いた２直線の交点の求め公式
        }
    }
    return {UpperPrice,LowerPrice,OptimumPrice,IndifferencePrice}
}
//ここまでは実際のPSMの各値を求める関数
//------------------------
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--csvfile") {
  console.error("Usage: ts-node psm.ts --csvfile filename.csv");
  process.exit(1);
}//例外処理
const csvFilename = args[1];
const csvPath = path.join(__dirname, csvFilename);//経路に応じてフィルをOpen
const readF: string = fs.readFileSync(csvPath, "utf8");//読んでデータをreadFに保存する
//ここまでは、データの読む
//------------------------
const f = fileSplit(readF);//データを行ごとで分離
const n = numberCount(f.rows,f.maxNumber,50);//各パーセントの計算
const c = calculatePSM(n,50);//PSMの各値の計算
//ここまでは、データの処理
//------------------------
console.log("最高価格　　　　:",Math.ceil(c.UpperPrice));
console.log("妥協価格　　　　:",Math.ceil(c.IndifferencePrice));
console.log("理想価格　　　　:",Math.ceil(c.OptimumPrice));
console.log("最低品質保証価格:",Math.ceil(c.LowerPrice));
//ここまでは結果の出力
//------------------------