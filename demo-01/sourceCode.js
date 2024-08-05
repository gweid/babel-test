console.log('调试-1')

function func() {
  console.info('调试-2')
}

export default class TestClass {
  say() {
    console.debug('调试-3');
  }

  render() {
    return <div>{console.error('调试-4')}</div>
  }
}