//增加任务调度功能，并且增加节流

const data = { foo: 1, bar: true };

//定义一个任务队列
const jobQueue = new Set();
const promise = Promise.resolve();
// 一个标志代表是否正在刷新队列
let isFlushing = false;

function flushJob() {
  //如果队列正在刷新则不继续执行副作用函数
  if (isFlushing) return;
  isFlushing = true;
  promise
    .then(() => {
      //刷新队列
      jobQueue.forEach((fn) => fn());
    })
    .then(() => {
      isFlushing = false;
    });
}
//WeakMap 由 target => Map 构成
//Map 由 key => Set 构成
let bucket = new WeakMap();

//当前激活的副作用函数
let activeEffect = null;
// effect 栈
const effectStack = [];

//副作用函数收集
function effect(fn, options = {}) {
  function effectFn() {
    // 调用 cleanup 函数完成清除工作
    cleanup(effectFn);
    activeEffect = effectFn;
    // 在调用副作用函数之前将当前副作用函数压入栈中
    effectStack.push(effectFn);
    fn();
    // 在当前副作用函数执行完毕后，将当前副作用函数弹出栈，并把 activeEffect 还原为之前的值
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
  }
  // 将 options 挂载到 effectFn 上
  effectFn.options = options;
  effectFn.deps = [];
  effectFn.nickname = fn.name;
  effectFn();
}

//cleanup函数的作用就是每次副作用函数执行前，将其从相关联的依赖集合中移除从而做到不依赖的属性不执行副作用函数
function cleanup(effectFn) {
  for (const dep of effectFn.deps) {
    dep.delete(effectFn);
  }
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
  const effectsToRun = new Set();
  effects.forEach((effect) => {
    // 如果 trigger 触发执行的副作用函数与当前正在执行的副作用函数相同，则不触发执行;
    if (effect !== activeEffect) {
      effectsToRun.add(effect);
    }
  });
  //执行副作用函数
  effectsToRun.forEach((effectFn) => {
    // 如果一个副作用函数存在调度器，则调用该调度器，并将副作用函数作为参数传递;
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
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

let p = getProxy(data);

effect(
  () => {
    console.log("p.foo: ", p.foo);
  },
  {
    scheduler(fn) {
      // 每次调度时，将副作用函数添加到 jobQueue 队列中，因为使用了set可以做到避免重复添加更新函数
      jobQueue.add(fn);
      // 调用 flushJob 刷新队列
      flushJob();
    },
  }
);

p.foo++;
p.foo++;
// console.log("执行结束");
