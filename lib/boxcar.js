// Node core dependencies
const crypto = require('crypto');
const url = require('url');
// External modules dependencies
const debug = require('debug')('api:handlers:Boxcar');
const request = require('request-promise');
const _ = require('lodash');

// Module wide properties
const config = {
	accessKey: '',
  secretKey: '',
  endpoint: '',
};

const endpoint = url.parse(config.endpoint);


/**
 * Generate URL Signature
 * @param method
 * @param body
 * @return {string}
 */
function signUrl(method, body) {
  const unkeyed = `${method}\n${endpoint.hostname}\n${endpoint.path}\n${body}`;
  const hmac = crypto.createHmac('sha1', config.secretKey);

  hmac.update(unkeyed);

  return hmac.digest('hex');
}


/**
 * Message composition
 * @param baseData
 * @param filters
 * @return {string}
 */
function createMessage(data, filters) {
  const push = {
    expires: (new Date()).getTime(),  // required to get a valid signature
    expires_after: 1800,
    aps: {
      badge: data.badge,
      alert: data.alert,
      sound: data.sound,
    },
    recipient: data.from,             // GMC do not allow reserved words
    senderName: data.fromName,        // or keys who starts with: from, to
  };

  /*
   * Remove object/array properties, because Boxcar.io only accepts
   * string or numeric values outside APS property.
   */
  const exclude = ['badge', 'alert', 'sound', 'to', 'from', 'fromName'];
  const extra = Object.assign({}, _.omitBy(_.omit(data, exclude), _.isObject));

  return JSON.stringify(Object.assign(extra, filters, push));
}


/**
 * Send push notification request to Boxcar
 * @param payload
 * @return {Promise}
 */
function pushMessage(payload) {
  const method = 'POST';
  debug('Payload:', payload);

  return request({
    method,
    uri: config.endpoint,
    body: payload,
    qs: {
      publishkey: config.accessKey,
      signature: signUrl(method, payload),
    },
    headers: {
      'content-type': 'application/json',
    },
  });
}


/**
 * Create new notification on Boxcar.io
 * @param {Object} data
 *
 * data: {
 *    badge, alert, sound,
 *    payload: {
 *      to, from, type, messageType,
 *      message, memberToNotify, sound, fromName,
 *      room, id, timestamp, conversationJid
 *    }
 * }
 */
function boxcarNotificationHandler(to, data) {
  const filters = {
    aliases: _.compact(_.castArray(to)),
  };

  return pushMessage(createMessage(data, filters));
}

module.exports = boxcarNotificationHandler;

