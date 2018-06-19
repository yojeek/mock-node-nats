'use strict';

const uuid = require('uuid/v4');

const {
  EventEmitter
} = require('events');

/**
 * Servers are isolated subscribers.
 */
const servers = {};

function getServer(url = '__default') {
  let server = servers[url] ? servers[url] : servers[url] = {
    subsBySid : new Map(),
    subsBySubject : new Map()
  };

  return server;
}

class NATS extends EventEmitter {
  /**
   * The mocked transport's subs for testing purposes.
   */
  static get subs() {
    return this.subsBySid;
  }

  /**
   * Fakes a connection to a nats-server and returns the client.
   *
   * @returns {NATS} client
   */
  static connect(params) {
    const nats =  new NATS(params);
    process.nextTick(() => nats.emit('connect'));

    return nats;
  }

  constructor({url}) {
    super();
    Object.assign(this, getServer(url))
  }

  /**
   * Fakes a disconnection.
   */
  close() {
    process.nextTick(() => this.emit('disconnect'));
  }

  /**
   * Subscribe to a given subject.
   *
   * @param {String} subject
   * @param {Object} [opts]
   * @param {Function} callback
   *
   * @returns {String} sid
   */
  subscribe(subject, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = undefined;
    }

    const sid = uuid();

    const sub = {
      sid,
      subject,
      callback
    };

    this._addSub(sub);

    return sid;
  }

  /**
   * Unsubscribe to a given Subscriber Id.
   *
   * @param {String} sid
   */
  unsubscribe(sid) {
    const sub = this.subsBySid.get(sid);

    if (sub == null) return;

    this.subsBySid.delete(sid);
    this.subsBySubject.get(sub.subject).delete(sid);
  }

  /**
   * Publish a message to the given subject, with optional `replyTo`.
   * TODO: implement optional callback
   *
   * @param {String} subject
   * @param {String} message
   * @param {String} replyTo
   */
  publish(subject, message, replyTo) {
    const subs = this.subsBySubject.get(subject) || new Map();

    for (const sub of subs.values()) {
      sub.callback(message, replyTo, subject);
    }
  }

  /**
   * Subscribe to an ad hoc subject to get a reply after publishing using this
   * ad hoc subject as the replyTo.
   *
   * @param {String} subject
   * @param {String} message
   * @param {Object} options
   * @param {Function} callback
   *
   * @returns {String} sid
   */
  request(subject, message, options, callback) {
    const sid = uuid();

    const sub = {
      sid,
      subject: sid,
      callback
    };

    this._addSub(sub);

    this.publish(subject, message, sid);

    return sid;
  }

  _addSub(sub) {
    this.subsBySid.set(sub.sid, sub);

    // NOTE: `this.subsBySubject` is a map (by subject) of maps (by sid)
    const subjectSubs = this.subsBySubject.get(sub.subject) || new Map();
    subjectSubs.set(sub.sid, sub);
    this.subsBySubject.set(sub.subject, subjectSubs);
  }
}

module.exports = NATS;
