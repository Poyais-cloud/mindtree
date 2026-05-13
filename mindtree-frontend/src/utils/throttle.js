export function throttle(fn, wait = 50) {
  let lastCall = 0
  let timer = null
  let lastArgs = null

  return function throttled(...args) {
    const now = Date.now()
    lastArgs = args

    // 距离上次执行够久了,立即执行
    if (now - lastCall >= wait) {
      lastCall = now
      fn.apply(this, args)
      return
    }

    // 否则安排一个定时器,保证"末次一定执行"
    if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now()
        timer = null
        fn.apply(this, lastArgs)
      }, wait - (now - lastCall))
    }
  }
}
