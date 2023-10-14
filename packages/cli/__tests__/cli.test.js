import path from 'node:path'
import { execa } from 'execa'

const CLI = path.join(__dirname, '../cli.js')
const bin = () => (...args) => execa(CLI, ...args)


// 运行错误的命令
test('run error command', async () => {
  try {
    const { stderr } = bin()('iii')
    console.log(stderr);
  } catch (error) {
    console.log('error ---->>>>', error);
  }
})

test('should not throw error when use --help', async () => {
  let error = null
  try {
    bin()('--help')
  } catch (e) {
    error = e
  }

  expect(error).toBe(null)
})



// const userPromise = () => Promise.resolve('hello')
// test('test promise', () => {
//   // 必须要用return返回出去，否则测试会提早结束，也不会进入到异步代码里面进行测试
//   return userPromise().then(data => {
//     expect(data).toBe('hello')
//   })
// })

// // async
// test('test async', async () => {
//   const data = await userPromise()
//   expect(data).toBe('hello')
// })