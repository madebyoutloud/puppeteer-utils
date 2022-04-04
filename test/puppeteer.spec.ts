import test from 'japa'
import Puppeteer from '../src/Puppeteer'

test.group('PuppeteerService', () => {
  test('request page', async (assert) => {
    const puppeteer = new Puppeteer()

    const result = await puppeteer.requestPage(async (page) => {
      await page.setContent('Hello World', {
        timeout: 10000,
        waitUntil: 'networkidle0',
      })

      return await page.content()
    })

    assert.equal(result, '<html><head></head><body>Hello World</body></html>')

    await puppeteer.destroy()
  })
})
