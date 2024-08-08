## 自动埋点



### 需求描述

埋点是一个常见的需求，比如在函数里面上报一些信息，如果每个函数，都手动引入，那么会很繁琐。

那么，此时可以进行自动埋点，在函数里面插入了一段代码，这段代码不影响其他逻辑，这种函数插入不影响逻辑的代码的手段叫做函数插桩。基于 babel 就可以实现自动的函数插桩。



比如：

```js
import aa from 'aa';
import * as bb from 'bb';
import { cc } from 'cc';
import 'dd';

function funcA() {
  console.log('funcA');
}

class BTest {
  funcB() {
    return 'funcB';
  }
}

const funcC = () => 'funC';

const funcD = function () {
  console.log('funD');
}
```

实现转换成

```js
import trackReport from "tracker";
import aa from 'aa';
import * as bb from 'bb';
import { cc } from 'cc';
import 'dd';

function funcA() {
  trackReport();
  console.log('funcA');
}

class BTest {
  funcB() {
    trackReport();
    return 'funcB';
  }
}

const funcC = () => {
  trackReport();
  return 'funC';
};

const funcD = function () {
  trackReport();
  console.log('funD');
}
```



这里要处理的：

- 引入 tracker 模块。需要判断是否引入过，没有的话就引入，并且生成个唯一 id 作为标识符
- 对所有函数在函数体开始插入 tracker 的代码



### 代码实现

