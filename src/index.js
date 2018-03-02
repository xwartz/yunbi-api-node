
/**
 * Created by xwartz(stddup@gmail.com|https://github.com/xwartz) on 2017-06-26.
 * API: https://yunbi.com/swagger/#/default
 */

const hmacSHA256 = require('crypto-js/hmac-sha256')
const axios = require('axios')

const END_POINT = 'https://yunbi.com//api/v2'

const API_URL = '/api/v2'

const request = axios.create({
  baseURL: END_POINT
})

function handleDataInvalid (res) {
  if (!res || typeof res.data === 'string') {
    throw new Error('yunbi_api_error')
  }
  return res.data
}

function cleanUpParams (params) {
  const keys = Object.keys(params)
  const newParams = {}
  keys.forEach(key => {
    if (params[key] !== null && params[key] !== undefined) {
      newParams[key] = params[key]
    }
  })
  return newParams
}

function querystring (params) {
  return Object.keys(params).map((param) => {
    return `${encodeURIComponent(param)}=${encodeURIComponent(params[param])}`
  }).sort().join('&')
}

function digest (data, secret) {
  return hmacSHA256(data, secret).toString()
}

class Yunbi {
  constructor (config) {
    this.access_key = config.access_key || ''
    this.secret_key = config.secret_key || ''
    this.timestampDiff = 0

    this.updateTimestampDiff()
  }

  updateTimestampDiff () {
    this.getTimestamp().then(timestamp => {
      const diff = timestamp * 1000 - Date.now()
      this.timestampDiff = diff
    })
  }

  _sign (verb, path, params = {}) {
    const newParams = Object.assign({}, params)
    newParams.access_key = this.access_key
    newParams.tonce = Date.now() + this.timestampDiff
    newParams.signature = digest(`${verb}|${API_URL}${path}|${querystring(newParams)}`, this.secret_key)
    return querystring(newParams)
  }

  _get (path, params = {}) {
    const verb = 'GET'
    const qs = this._sign(verb, path, params)
    return request.get(`${path}?${qs}`).then(res => handleDataInvalid(res))
  }

  _post (path, params = {}) {
    const verb = 'POST'
    const qs = this._sign(verb, path, params)
    return request.post(path, qs).then(res => handleDataInvalid(res))
  }

  _public (path, params = {}) {
    return request.get(`${path}?${querystring(params)}`).then(res => handleDataInvalid(res))
  }

  /**
   * Get server current time, in seconds since Unix epoch.
   */
  getTimestamp () {
    return this._public('/timestamp')
  }

  /**
   * Get all available markets
   */
  getMarkets () {
    return this._public('/markets')
  }

  /**
   * Get ticker of all markets.
   */
  getTickers () {
    return this._public('/tickers')
  }

  /**
   * Get ticker of specific market
   * @param  {string} market 'ethcny'
   */
  getTicker (market) {
    return this._public(`/tickers/${market}`)
  }

  /**
   * Get the order book of specified market
   * @param  {string} market 'ethcny'
   */
  getOrderBook (market, limit = 100) {
    const params = {
      market: market,
      asks_limit: limit,
      bids_limit: limit
    }
    return this._public('/order_book', params)
  }

  /**
   * Get OHLC(k line) of specific market
   */
  getK ({ market, limit, period, timestamp }) {
    const params = cleanUpParams({ market, limit, period, timestamp })
    return this._public('/k', params)
  }

  /**
   * Get K data with pending trades, which are the trades not included in K data yet, because there's delay between trade generated and processed by K data generator.
   */
  getKPendingTrades ({ market, tradeId, limit, period, timestamp }) {
    const params = cleanUpParams({ market, trade_id: tradeId, period, limit, timestamp })
    return this._public('/k_with_pending_trades', params)
  }

  /**
   * Get depth or specified market. Both asks and bids are sorted from highest price to lowest.
   */
  getDepth (market, limit = 100) {
    const params = { market, limit }
    return this._public('/depth', params)
  }

  /**
   * Get your profile and accounts info
   */
  getMember () {
    return this._get('/members/me')
  }

  /**
   * Get your orders, results is paginated.
   */
  getOrders ({ market, state = 'wait', limit = 20, page = 0, orderBy = 'asc' }) {
    const params = { market, state, limit, page, order_by: orderBy }
    return this._get('/orders', params)
  }

  /**
   * Get information of specified order
   */
  getOrder (orderId) {
    const params = { id: orderId }
    return this._get('/order', params)
  }

  /**
   * Create a Buy order
   */
  buy ({ market, price, volume }) {
    const params = { market, price, volume, side: 'buy' }
    return this._post('/orders', params)
  }

  /**
   * Create a Sell order
   */
  sell ({ market, price, volume }) {
    const params = { market, price, volume, side: 'sell' }
    return this._post('/orders', params)
  }

  /**
   * Cancel an order
   */
  cancelOrder (id) {
    return this._post('/order/delete', { id })
  }

  /**
   * Cancel all my orders
   */
  cancelAllOrders (side = 'buy') {
    const params = { side }
    return this._post('/orders/clear', params)
  }

  /**
   * Get your deposits history.
   * @param  {string} currency Currency value contains cny,btc,eth,bts,sc,etc
   * @param  {String} state    Filter by state.
   * @param  {Number} limit    Set result limit.
   * @return {[type]}          return promise
   */
  getDeposits (currency, state, limit = 100) {
    const params = { currency, limit, state }
    return this._get('/deposits', params)
  }

  /**
   * Get your executed trades. Trades are sorted in reverse creation order.
   * @param  {string} market Unique market id, 'ethcny'
   * @return {[type]}          return promise
   */
  getMyTrades ({ market, limit, timestamp, from, to, orderby }) {
    const params = cleanUpParams({ market, limit, timestamp, from, to, order_by: orderby })
    return this._get('/trades/my', params)
  }

  /**
   * Get recent trades on market, each trade is included only once. Trades are sorted in reverse creation order
   */
  getRecentTrades ({ market, limit, timestamp, from, to, orderby }) {
    const params = cleanUpParams({ market, limit, timestamp, from, to, order_by: orderby })
    return this._get('/trades', params)
  }

  getDepositAddress (currency) {
    const params = { currency }
    return this._get('/deposit_address', params)
  }
}

module.exports = Yunbi
