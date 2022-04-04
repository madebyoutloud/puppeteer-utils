import puppeteer from 'puppeteer'

export type PuppeteerConfig = {
  browserEndpoint?: string
  maxInactivity: number
  timeout: number
}

export type PuppeteerOptions = Partial<PuppeteerConfig>

export default class Puppeteer {
  private config: PuppeteerConfig

  private browserPromise?: Promise<puppeteer.Browser>
  private browser?: puppeteer.Browser
  private closeBrowserTimeout?: ReturnType<typeof setTimeout>
  private requests: number = 0

  constructor(options: PuppeteerOptions = {}) {
    this.config = Object.assign(
      {
        maxInactivity: 30 * 1000,
        timeout: 10000,
      },
      options
    )
  }

  private get isConnect() {
    return !!this.config.browserEndpoint
  }

  private async requestBrowser() {
    this.requests++

    if (this.closeBrowserTimeout) {
      clearTimeout(this.closeBrowserTimeout)
      this.closeBrowserTimeout = undefined
    }

    if (this.browserPromise) {
      return await this.browserPromise
    }

    if (this.isConnect) {
      this.browserPromise = puppeteer.connect({
        browserWSEndpoint: this.config.browserEndpoint,
      })
    } else {
      this.browserPromise = puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        timeout: this.config.timeout,
      })
    }

    this.browserPromise.then((browser) => {
      this.browser = browser
    })

    return await this.browserPromise
  }

  private releaseBrowser() {
    this.requests--

    if (!this.requests && !this.closeBrowserTimeout) {
      this.closeBrowserTimeout = setTimeout(() => {
        this.closeBrowserTimeout = undefined

        this.closeBrowser()
      }, this.config.maxInactivity)
    }
  }

  private async closeBrowser() {
    const browser = this.browserPromise ? await this.browserPromise : this.browser

    if (!browser) {
      return
    }

    this.browser = undefined

    if (this.isConnect) {
      browser.disconnect()
    } else {
      browser.close()
    }
  }

  // TODO: add queue handling, so you can not handle more than x requests at a time
  public async requestPage<T>(callback: (page: puppeteer.Page) => T): Promise<T> {
    let browser: puppeteer.Browser | undefined
    let page: puppeteer.Page | undefined

    try {
      browser = await this.requestBrowser()
      page = await browser!.newPage()

      const result = await callback(page)

      page &&
        page.close().catch((_err) => {
          // ignore
        })

      this.releaseBrowser()

      return result
    } catch (err) {
      page &&
        page.close().catch((_err) => {
          // ignore
        })

      browser && this.releaseBrowser()

      throw err
    }
  }

  public async destroy() {
    if (this.closeBrowserTimeout) {
      clearTimeout(this.closeBrowserTimeout)
      this.closeBrowserTimeout = undefined
    }

    await this.closeBrowser()
  }
}
