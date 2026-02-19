'use strict';

/**
 * ZoneMTA plugin: tino-zonemta-delivery-tracker
 *
 * Captures email delivery events (delivered, bounced, deferred) from ZoneMTA
 * hook callbacks and POSTs them to the TinoMail Monitor backend.
 *
 * Hooks used:
 *   - sender:delivered     — successful delivery (SMTP 2xx)
 *   - queue:bounce         — hard bounce (permanent failure)
 *   - sender:responseError — SMTP error (soft bounce / deferred)
 */

const os = require('os');
const http = require('http');
const https = require('https');

const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 5000;
const REQUEST_TIMEOUT_MS = 10000;
const DSN_SENDER = 'mailer-daemon@tino.vn';

module.exports.title = 'Tino Delivery Tracker';
module.exports.init = function (app, done) {
    const serverUrl = app.config.serverUrl || 'https://mail-monitor.tino.vn';
    const apiKey = app.config.apiKey || '';
    const nodeId = app.config.nodeId || os.hostname();

    if (!apiKey) {
        app.logger.error('Monitor', 'Missing apiKey in plugin config — events will NOT be sent');
        return done();
    }

    const ingestUrl = serverUrl.replace(/\/$/, '') + '/api/v1/events/ingest';
    const isHttps = ingestUrl.startsWith('https');

    let buffer = [];
    let flushTimer = null;

    /** POST events to backend */
    function sendEvents(events) {
        const body = JSON.stringify(events);
        const parsed = new URL(ingestUrl);

        const options = {
            hostname: parsed.hostname,
            port: parsed.port || (isHttps ? 443 : 80),
            path: parsed.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'x-api-key': apiKey,
            },
            timeout: REQUEST_TIMEOUT_MS,
        };

        const transport = isHttps ? https : http;

        const req = transport.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    app.logger.info('Monitor', 'Flushed %d events (HTTP %d)', events.length, res.statusCode);
                } else {
                    app.logger.error('Monitor', 'Ingest failed HTTP %d: %s', res.statusCode, data.substring(0, 200));
                }
            });
        });

        req.on('error', (err) => {
            app.logger.error('Monitor', 'Request failed: %s', err.message);
        });

        req.on('timeout', () => {
            req.destroy();
            app.logger.error('Monitor', 'Request timed out');
        });

        req.write(body);
        req.end();
    }

    function flush() {
        if (buffer.length === 0) return;
        const batch = buffer.splice(0, buffer.length);
        sendEvents(batch);
    }

    function pushEvent(event) {
        buffer.push(event);
        if (buffer.length >= BATCH_SIZE) {
            flush();
        }
    }

    function parseSmtpCode(response) {
        if (!response) return undefined;
        const match = String(response).match(/^(\d{3})[\s-]/);
        return match ? parseInt(match[1], 10) : undefined;
    }

    /** Resolve sender — use DSN_SENDER for null-sender bounce messages */
    function resolveSender(from) {
        const addr = (from || '').toString();
        if (addr.includes('@')) return addr;
        return addr === '' ? DSN_SENDER : undefined;
    }

    flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

    // --- Hook: successful delivery ---
    app.addHook('sender:delivered', (delivery, info, next) => {
        try {
            const recipient = (delivery.recipient || '').toString();
            const from = (delivery.from || '').toString();
            const response = (info.response || '').toString();

            pushEvent({
                time: new Date().toISOString(),
                eventType: 'delivered',
                queueId: delivery.id || delivery.seq,
                messageId: delivery.messageId,
                fromAddress: resolveSender(from),
                toAddress: recipient.includes('@') ? recipient : undefined,
                toDomain: delivery.domain,
                mtaNode: nodeId,
                sendingIp: delivery.localAddress || undefined,
                mxHost: (info.mx || '').toString() || undefined,
                statusCode: parseSmtpCode(response),
                statusMessage: response.substring(0, 500) || undefined,
                deliveryTimeMs: info.timer ? Math.round(info.timer) : undefined,
            });
        } catch (err) {
            app.logger.error('Monitor', 'delivered hook error: %s', err.message);
        }
        next();
    });

    // --- Hook: SMTP response error (deferred / temp failure) ---
    app.addHook('sender:responseError', (delivery, connection, err, next) => {
        try {
            const recipient = (delivery.recipient || '').toString();
            const from = (delivery.from || '').toString();
            const response = (err && err.response || '').toString();
            const statusCode = parseSmtpCode(response);

            const eventType = statusCode && statusCode >= 500 ? 'bounced' : 'deferred';
            const bounceType = eventType === 'bounced' ? 'hard' : 'soft';

            pushEvent({
                time: new Date().toISOString(),
                eventType,
                queueId: delivery.id || delivery.seq,
                messageId: delivery.messageId,
                fromAddress: resolveSender(from),
                toAddress: recipient.includes('@') ? recipient : undefined,
                toDomain: delivery.domain,
                mtaNode: nodeId,
                sendingIp: delivery.localAddress || undefined,
                mxHost: connection && connection.options && connection.options.name || undefined,
                statusCode,
                statusMessage: response.substring(0, 500) || undefined,
                bounceType,
                bounceMessage: (err && err.message || '').substring(0, 500) || undefined,
            });
        } catch (hookErr) {
            app.logger.error('Monitor', 'responseError hook error: %s', hookErr.message);
        }
        next();
    });

    // --- Hook: bounce (permanent failure) ---
    app.addHook('queue:bounce', (bounce, mailer, next) => {
        try {
            const recipient = (bounce.recipient || '').toString();
            const from = (bounce.from || '').toString();

            pushEvent({
                time: new Date().toISOString(),
                eventType: 'bounced',
                queueId: bounce.id || bounce.seq,
                messageId: bounce.messageId,
                fromAddress: resolveSender(from),
                toAddress: recipient.includes('@') ? recipient : undefined,
                toDomain: bounce.domain,
                mtaNode: nodeId,
                bounceType: 'hard',
                bounceCategory: (bounce.category || '').toString() || undefined,
                bounceMessage: (bounce.message || '').toString().substring(0, 500) || undefined,
            });
        } catch (err) {
            app.logger.error('Monitor', 'bounce hook error: %s', err.message);
        }
        next();
    });

    app.addHook('close', (next) => {
        if (flushTimer) {
            clearInterval(flushTimer);
            flushTimer = null;
        }
        flush();
        next();
    });

    app.logger.info('Monitor', 'Plugin loaded — sending events to %s (node=%s)', ingestUrl, nodeId);
    done();
};
