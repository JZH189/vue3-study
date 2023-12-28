//解决嵌套的effectFn方案

const data = { foo: true, bar: true };

//WeakMap 由 target => Map 构成
//Map 由 key => Set 构成
let bucket = new WeakMap();

//当前激活的副作用函数
let activeEffect = null;
// effect 栈
const effectStack = [];

//副作用函数收集
function effect(fn) {
  function effectFn() {
    // 调用 cleanup 函数完成清除工作
    cleanup(effectFn);
    activeEffect = effectFn;
    // 在调用副作用函数之前将当前副作用函数压入栈中
    effectStack.push(effectFn); // 新增
    fn();
    // 在当前副作用函数执行完毕后，将当前副作用函数弹出栈，并把 activeEffect 还原为之前的值
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
  }
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

let p = getProxy(data);

// 全局变量
let temp1, temp2;

// effectFn1 嵌套了 effectFn2
effect(function effectFn1() {
  console.log("effectFn1 执行");

  effect(function effectFn2() {
    console.log("effectFn2 执行");
    // 在 effectFn2 中读取 obj.bar 属性
    temp2 = p.bar;
  });
  // 在 effectFn1 中读取 obj.foo 属性
  temp1 = p.foo;
});

for (const item of bucket.get(data).values()) {
  item.forEach((effect) => {
    console.log(effect.nickname);
  });
}
p.foo = "nihao";
