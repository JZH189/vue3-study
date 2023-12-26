const obj = { text: "hello nestjs", isOk: true };

//WeakMap 由 target => Map 构成
//Map 由 key => Set 构成
let bucket = new WeakMap();

let activeEffect = null;

function effct(fn) {
  function effectFn() {
    // 调用 cleanup 函数完成清除工作
    cleanup(effectFn);
    activeEffect = effectFn;
    fn();
  }
  effectFn.deps = [];
  effectFn();
}

function cleanup(effectFn) {
  // for (const dep of effectFn.deps) {
  //   dep.delete(effectFn);
  // }
  //清空deps数组
  effectFn.deps.length = 0;
}

//依赖收集
function track(target, key) {
  //根据target从“桶”中取得depsMap,它也是一个Map类型： key => effects
  let depsMap = bucket.get(target);
  //如果不存在depsMap,则新建一个Map并与target关联
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }
  //再根据key从depsMap中取得deps,它是一个Set类型，里面储存着所有与当前key相关联的副作用函数 effects
  let deps = depsMap.get(key);
  //如果deps不存在，同样建立一个Set并与key关联
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  //最后将当前激活的副作用函数添加到“桶”里
  deps.add(activeEffect);
  // 将deps的set结构添加到 activeEffect.deps 数组中
  activeEffect.deps.push(deps);
}

//触发更新
function trigger(target, key) {
  //根据target从“桶”中取得depsMap,它是key => effects
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  //根据key取得所有副作用函数 effects
  const effects = depsMap.get(key);
  const effectsToRun = new Set(effects); // 新增
  //执行副作用函数
  effectsToRun.forEach((fn) => fn());
}

function getProxy(data) {
  return new Proxy(data, {
    get(target, key) {
      if (!activeEffect) return target[key];
      //收集依赖
      track(target, key);
      //返回属性值
      return target[key];
    },
    set(target, key, newVal) {
      //设置属性值
      target[key] = newVal;
      //触发更新
      trigger(target, key);
    },
  });
}

let p = getProxy(obj);

function changeInnerText() {
  document.body.innerText = p.isOk ? p.text : "not ok";
  console.log("bucket", bucket);
}

effct(changeInnerText);

setTimeout(() => {
  p.isOk = false;
}, 3000);
